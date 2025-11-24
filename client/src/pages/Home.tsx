import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, Mic, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ConversationMessage = {
  id: number;
  speaker: "nurse" | "patient";
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  timestamp: Date;
};

type ProcessingStatus = "idle" | "listening" | "vad-detected" | "recognizing" | "translating" | "speaking";

const LANGUAGE_OPTIONS = [
  { value: "vi", label: "越南語" },
  { value: "id", label: "印尼語" },
  { value: "fil", label: "菲律賓語" },
  { value: "en", label: "英文" },
  { value: "it", label: "義大利語" },
  { value: "ja", label: "日文" },
  { value: "ko", label: "韓文" },
  { value: "th", label: "泰文" },
];

// VAD Settings
const RMS_THRESHOLD = 0.02; // Voice activity detection threshold
const SILENCE_DURATION_MS = 800; // 600-900ms range, using 800ms
const CHUNK_INTERVAL_MS = 100; // Small chunks for fine-grained VAD control

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("vi");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const messageIdRef = useRef(0);
  const nurseScrollRef = useRef<HTMLDivElement>(null);
  const patientScrollRef = useRef<HTMLDivElement>(null);

  // VAD-controlled chunk collection
  const currentChunksRef = useRef<Blob[]>([]); // Current speech segment chunks
  const lastSpeechTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  const vadIntervalRef = useRef<number | null>(null);

  // tRPC mutations
  const translateMutation = trpc.translation.autoTranslate.useMutation();

  // Check audio level (VAD)
  const checkAudioLevel = useCallback(() => {
    if (!analyserRef.current) return false;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Update audio level display
    setAudioLevel(rms / RMS_THRESHOLD);

    return rms > RMS_THRESHOLD;
  }, []);

  // Process speech segment (merge chunks and send to Whisper)
  const processSpeechSegment = useCallback(async () => {
    const chunks = currentChunksRef.current;
    if (chunks.length === 0) {
      console.log("[processSpeechSegment] No chunks to process");
      return;
    }

    console.log(`[processSpeechSegment] Processing ${chunks.length} chunks`);
    setProcessingStatus("recognizing");

    try {
      // Merge chunks using Blob (no ffmpeg needed!)
      const mergedBlob = new Blob(chunks, { type: "audio/webm" });
      console.log(`[processSpeechSegment] Merged blob size: ${mergedBlob.size} bytes`);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];

        try {
          setProcessingStatus("translating");
          const result = await translateMutation.mutateAsync({
            audioBase64: base64Audio,
            filename: `audio-${Date.now()}.webm`,
            preferredTargetLang: targetLanguage,
          });

          if (result.success && result.sourceText && result.translatedText) {
            const speaker = result.direction === "nurse_to_patient" ? "nurse" : "patient";
            const newMessage: ConversationMessage = {
              id: messageIdRef.current++,
              speaker,
              originalText: result.sourceText,
              translatedText: result.translatedText,
              detectedLanguage: result.sourceLang || "unknown",
              timestamp: new Date(),
            };

            setConversations((prev) => [...prev, newMessage]);
            console.log(`[processSpeechSegment] Added message:`, newMessage);
          } else {
            console.error("[processSpeechSegment] Translation failed:", result.error);
            if (result.error && !result.error.includes("No speech detected")) {
              toast.error(result.error);
            }
          }
        } catch (error: any) {
          console.error("[processSpeechSegment] Error:", error);
          toast.error("處理語音時發生錯誤");
        } finally {
          setProcessingStatus("listening");
        }
      };
      reader.readAsDataURL(mergedBlob);

      // Clear chunks for next segment
      currentChunksRef.current = [];
    } catch (error: any) {
      console.error("[processSpeechSegment] Error:", error);
      toast.error("處理語音時發生錯誤");
      setProcessingStatus("listening");
    }
  }, [targetLanguage, translateMutation]);

  // Start VAD monitoring
  const startVADMonitoring = useCallback(() => {
    if (vadIntervalRef.current !== null) return;

    console.log("[VAD] Started VAD monitoring");
    setProcessingStatus("listening");

    vadIntervalRef.current = window.setInterval(() => {
      const isSpeaking = checkAudioLevel();
      const now = Date.now();

      if (isSpeaking) {
        // Speech detected
        lastSpeechTimeRef.current = now;
        if (!isSpeakingRef.current) {
          // Speech segment start (無聲 → 有聲)
          isSpeakingRef.current = true;
          currentChunksRef.current = []; // Start new chunk buffer
          setProcessingStatus("vad-detected");
          console.log(`🔵 Speech started`);
        }
      } else {
        // Silence
        if (isSpeakingRef.current) {
          const silenceDuration = now - lastSpeechTimeRef.current;
          if (silenceDuration >= SILENCE_DURATION_MS) {
            // Speech segment end (有聲 → 無聲，持續 800ms)
            isSpeakingRef.current = false;
            setProcessingStatus("listening");
            console.log(`🟢 Speech ended (silence: ${silenceDuration}ms), processing...`);

            // Process this speech segment
            processSpeechSegment();
          }
        }
      }
    }, 100);
  }, [checkAudioLevel, processSpeechSegment]);

  // Stop VAD monitoring
  const stopVADMonitoring = useCallback(() => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
      console.log("[VAD] Stopped VAD monitoring");
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Setup Web Audio API for VAD
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Setup MediaRecorder (WebM Opus)
      const mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error("WebM Opus format not supported");
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 48000,
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect chunks only during speech
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && isSpeakingRef.current) {
          console.log(`[MediaRecorder] Chunk collected, size: ${event.data.size} bytes`);
          currentChunksRef.current.push(event.data);
        }
      };

      // Start recording with small chunk interval for VAD control
      mediaRecorder.start(CHUNK_INTERVAL_MS);
      console.log(`[MediaRecorder] Started recording with ${CHUNK_INTERVAL_MS}ms chunks`);

      // Start VAD monitoring
      startVADMonitoring();

      setIsRecording(true);
      toast.success("開始錄音");
    } catch (error: any) {
      console.error("[startRecording] Error:", error);
      toast.error("無法啟動麥克風");
    }
  }, [startVADMonitoring]);

  // Stop recording
  const stopRecording = useCallback(() => {
    console.log("[stopRecording] Stopping recording");
    stopVADMonitoring();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear chunks
    currentChunksRef.current = [];
    isSpeakingRef.current = false;
    setAudioLevel(0);
    setProcessingStatus("idle");
    setIsRecording(false);
    toast.success("停止錄音");
  }, [stopVADMonitoring]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Clear conversations
  const clearConversations = useCallback(() => {
    setConversations([]);
    messageIdRef.current = 0;
    toast.success("已清除對話記錄");
  }, []);

  // Export conversations
  const exportConversations = useCallback(() => {
    if (conversations.length === 0) {
      toast.error("沒有對話記錄可匯出");
      return;
    }

    const content = conversations
      .map((msg) => {
        const speaker = msg.speaker === "nurse" ? "台灣人" : "外國人";
        const time = msg.timestamp.toLocaleTimeString("zh-TW");
        return `[${time}] ${speaker}:\n原文: ${msg.originalText}\n譯文: ${msg.translatedText}\n`;
      })
      .join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `對話記錄_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("對話記錄已匯出");
  }, [conversations]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (nurseScrollRef.current) {
      nurseScrollRef.current.scrollTop = nurseScrollRef.current.scrollHeight;
    }
    if (patientScrollRef.current) {
      patientScrollRef.current.scrollTop = patientScrollRef.current.scrollHeight;
    }
  }, [conversations]);

  // Get status display
  const getStatusDisplay = () => {
    switch (processingStatus) {
      case "listening":
        return "🔵 等待語音...";
      case "vad-detected":
        return "🟢 偵測到語音...";
      case "recognizing":
        return "🟡 正在辨識...";
      case "translating":
        return "🟣 正在翻譯...";
      case "speaking":
        return "🔊 播放中...";
      default:
        return "閒置";
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">即時雙向翻譯系統</h1>
          <div className="flex items-center gap-4">
            <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isRecording}>
              <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="選擇語言" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={exportConversations} disabled={conversations.length === 0}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={clearConversations} disabled={conversations.length === 0}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-gray-900 p-3 text-center text-sm">
        <div className="container mx-auto flex items-center justify-center gap-4">
          <span>{getStatusDisplay()}</span>
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">音量:</span>
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${audioLevel > 1 ? "bg-green-500" : "bg-gray-600"}`}
                  style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-6">
        <div className="text-center mb-6 text-gray-400">
          點擊「開始對話」後，系統將持續偵測語音並即時翻譯
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Nurse (Chinese) */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-center">台灣人 (中文)</h2>
            <div ref={nurseScrollRef} className="h-[400px] overflow-y-auto space-y-3">
              {conversations
                .filter((msg) => msg.speaker === "nurse")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-3 rounded">
                    <div className="text-sm text-gray-400 mb-1">{msg.timestamp.toLocaleTimeString("zh-TW")}</div>
                    <div className="font-medium mb-1">{msg.originalText}</div>
                    <div className="text-gray-400 text-sm">→ {msg.translatedText}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Patient (Foreign Language) */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-center">外國人 (外語)</h2>
            <div ref={patientScrollRef} className="h-[400px] overflow-y-auto space-y-3">
              {conversations
                .filter((msg) => msg.speaker === "patient")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-3 rounded">
                    <div className="text-sm text-gray-400 mb-1">{msg.timestamp.toLocaleTimeString("zh-TW")}</div>
                    <div className="font-medium mb-1">{msg.originalText}</div>
                    <div className="text-gray-400 text-sm">→ {msg.translatedText}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Control Button */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={toggleRecording}
            className={`px-8 py-6 text-lg ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Mic className="mr-2 h-5 w-5" />
            {isRecording ? "結束對話" : "開始對話"}
          </Button>
        </div>
      </main>
    </div>
  );
}
