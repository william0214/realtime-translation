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
const RMS_THRESHOLD = 0.02;
const SILENCE_DURATION_MS = 1200; // Increased to 1.2s for better speech detection

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

  // VAD state
  const audioChunksRef = useRef<Blob[]>([]);
  const lastSpeechTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  const vadIntervalRef = useRef<number | null>(null);

  // tRPC mutations
  const audioChunkMutation = trpc.audio.chunk.useMutation();
  const languageIdentifyMutation = trpc.language.identify.useMutation();
  const translateMutation = trpc.translate.text.useMutation();

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

  // Process audio chunk
  const processAudioChunk = useCallback(
    async (audioBlob: Blob) => {
      console.log(`[processAudioChunk] Processing audio blob, size: ${audioBlob.size} bytes`);
      
      if (audioBlob.size < 1000) {
        console.log("Audio chunk too small, skipping...");
        return;
      }

      setProcessingStatus("recognizing");

      try {
        // Step 1: Whisper transcription
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          if (!base64Audio) {
            console.error("Failed to convert audio to base64");
            setProcessingStatus("listening");
            return;
          }

          console.log(`[processAudioChunk] Sending to Whisper API, base64 length: ${base64Audio.length}`);

          const transcriptResult = await audioChunkMutation.mutateAsync({
            audioBase64: base64Audio,
            filename: `audio-${Date.now()}.webm`,
          });

          if (!transcriptResult.success || !transcriptResult.text) {
            console.log("[processAudioChunk] No speech detected or transcription failed");
            setProcessingStatus("listening");
            return;
          }

          const sourceText = transcriptResult.text;
          console.log(`[processAudioChunk] Transcript: "${sourceText}"`);

          // Step 2: Language identification
          setProcessingStatus("translating");
          const langResult = await languageIdentifyMutation.mutateAsync({
            text: sourceText,
          });

          const detectedLanguage = langResult.language || "zh";
          console.log(`[processAudioChunk] Detected language: ${detectedLanguage}`);

          // Step 3: Determine direction
          const isNurse = ["zh", "zh-tw", "zh-cn", "cmn", "yue", "chinese"].includes(
            detectedLanguage.toLowerCase()
          );
          const speaker = isNurse ? "nurse" : "patient";
          const sourceLang = isNurse ? "zh" : detectedLanguage;
          const targetLang = isNurse ? targetLanguage : "zh";

          // Step 4: Translate
          const translateResult = await translateMutation.mutateAsync({
            text: sourceText,
            sourceLang,
            targetLang,
          });

          if (!translateResult.success || !translateResult.translatedText) {
            console.log("[processAudioChunk] Translation failed");
            setProcessingStatus("listening");
            return;
          }

          console.log(`[processAudioChunk] Translation: "${translateResult.translatedText}"`);

          // Add to conversation
          const newMessage: ConversationMessage = {
            id: messageIdRef.current++,
            speaker,
            originalText: sourceText,
            translatedText: translateResult.translatedText,
            detectedLanguage,
            timestamp: new Date(),
          };

          setConversations((prev) => [...prev, newMessage]);
          setProcessingStatus("listening");

          // Auto-scroll
          setTimeout(() => {
            if (speaker === "nurse" && nurseScrollRef.current) {
              nurseScrollRef.current.scrollTop = nurseScrollRef.current.scrollHeight;
            } else if (speaker === "patient" && patientScrollRef.current) {
              patientScrollRef.current.scrollTop = patientScrollRef.current.scrollHeight;
            }
          }, 100);
        };
        reader.readAsDataURL(audioBlob);
      } catch (error: any) {
        console.error("[processAudioChunk] Error:", error);
        toast.error("處理失敗：" + error.message);
        setProcessingStatus("listening");
      }
    },
    [audioChunkMutation, languageIdentifyMutation, translateMutation, targetLanguage]
  );

  // VAD monitoring loop
  const startVADMonitoring = useCallback(() => {
    console.log("[VAD] Starting VAD monitoring");
    vadIntervalRef.current = window.setInterval(() => {
      const isSpeaking = checkAudioLevel();
      const now = Date.now();

      if (isSpeaking) {
        // Speech detected
        lastSpeechTimeRef.current = now;
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          setProcessingStatus("vad-detected");
          console.log("🔵 Speech started");
        }
      } else {
        // Silence
        if (isSpeakingRef.current) {
          const silenceDuration = now - lastSpeechTimeRef.current;
          if (silenceDuration >= SILENCE_DURATION_MS) {
            // Speech ended, process audio
            isSpeakingRef.current = false;
            setProcessingStatus("listening");
            console.log(`🟢 Speech ended (silence: ${silenceDuration}ms), processing audio...`);

            if (audioChunksRef.current.length > 0) {
              const audioBlob = new Blob(audioChunksRef.current, {
                type: "audio/webm;codecs=opus",
              });
              console.log(`[VAD] Created audio blob, size: ${audioBlob.size} bytes, chunks: ${audioChunksRef.current.length}`);
              processAudioChunk(audioBlob);
              audioChunksRef.current = [];
            } else {
              console.log("[VAD] No audio chunks collected");
            }
          }
        }
      }
    }, 100);
  }, [checkAudioLevel, processAudioChunk]);

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

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[MediaRecorder] Data available, size: ${event.data.size} bytes, total chunks: ${audioChunksRef.current.length}`);
        }
      };

      // Start recording with timeslice for continuous chunks
      mediaRecorder.start(100); // Request data every 100ms
      console.log("[MediaRecorder] Started recording");

      // Start VAD monitoring
      startVADMonitoring();

      setIsRecording(true);
      setProcessingStatus("listening");
      toast.success("開始對話");
    } catch (error) {
      toast.error("無法啟動麥克風：" + (error as Error).message);
      console.error("[startRecording] Error:", error);
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

    audioChunksRef.current = [];
    isSpeakingRef.current = false;
    lastSpeechTimeRef.current = 0;
    analyserRef.current = null;

    setIsRecording(false);
    setAudioLevel(0);
    setProcessingStatus("idle");
    toast.info("結束對話");
  }, [stopVADMonitoring]);

  // Clear conversations
  const clearConversations = useCallback(() => {
    setConversations([]);
    messageIdRef.current = 0;
    toast.success("對話記錄已清除");
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
        const lang = msg.detectedLanguage.toUpperCase();
        return `[${time}] ${speaker} (${lang})\n原文: ${msg.originalText}\n譯文: ${msg.translatedText}\n`;
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

  // Cleanup
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  // Status message
  const getStatusMessage = () => {
    switch (processingStatus) {
      case "listening":
        return "🟢 等待語音...";
      case "vad-detected":
        return "🔵 偵測到語音...";
      case "recognizing":
        return "🟡 正在辨識...";
      case "translating":
        return "🟣 正在翻譯...";
      case "speaking":
        return "🔊 播放中...";
      default:
        return "";
    }
  };

  const getLanguageLabel = (code: string) => {
    const lang = LANGUAGE_OPTIONS.find((l) => l.value === code);
    return lang ? lang.label : code;
  };

  return (
    <div className="min-h-screen flex flex-col bg-black/80 text-white">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">即時雙向翻譯系統</h1>
          <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isRecording}>
            <SelectTrigger className="w-[180px] bg-white/10 border-white/20">
              <SelectValue placeholder="選擇目標語言" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={exportConversations}
            disabled={conversations.length === 0}
            className="bg-white/10 border-white/20 hover:bg-white/20"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={clearConversations}
            disabled={conversations.length === 0}
            className="bg-white/10 border-white/20 hover:bg-white/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6">
        <p className="text-center text-white/60 mb-4">
          點擊「開始對話」後，系統將持續偵測語音並即時翻譯
        </p>

        {/* Processing status indicator */}
        {processingStatus !== "idle" && (
          <div className="fixed top-20 right-6 bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg border border-white/20 text-lg z-50">
            {getStatusMessage()}
          </div>
        )}

        {/* Audio level indicator */}
        {isRecording && (
          <div className="mb-6 flex items-center justify-center gap-4">
            <span className="text-sm text-white/60">音量:</span>
            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  isSpeakingRef.current ? "bg-green-500" : "bg-white/30"
                }`}
                style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              />
            </div>
            <span className="text-sm text-white/60">
              {isSpeakingRef.current ? "偵測到語音" : "靜音"}
            </span>
          </div>
        )}

        {/* Conversation Display */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* 台灣人 (中文) */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-center">台灣人 (中文)</h2>
            <div ref={nurseScrollRef} className="space-y-4 max-h-[500px] overflow-y-auto scroll-smooth">
              {conversations
                .filter((msg) => msg.speaker === "nurse")
                .map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20"
                  >
                    <p className="text-lg mb-2">{msg.originalText}</p>
                    <p className="text-sm text-white/60">→ {msg.translatedText}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* 外國人 (外語) */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-center">外國人 (外語)</h2>
            <div ref={patientScrollRef} className="space-y-4 max-h-[500px] overflow-y-auto scroll-smooth">
              {conversations
                .filter((msg) => msg.speaker === "patient")
                .map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 relative"
                  >
                    <span className="absolute top-2 right-2 text-xs bg-white/20 px-2 py-1 rounded">
                      {getLanguageLabel(msg.detectedLanguage)}
                    </span>
                    <p className="text-lg mb-2">{msg.originalText}</p>
                    <p className="text-sm text-white/60">→ {msg.translatedText}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Control Button */}
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg"
            >
              <Mic className="mr-2 h-5 w-5" />
              開始對話
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-lg"
            >
              <Mic className="mr-2 h-5 w-5" />
              結束對話
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
