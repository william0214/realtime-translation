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

// Settings
const RMS_THRESHOLD = 0.02; // Voice activity detection threshold
const SILENCE_DURATION_MS = 800; // Silence duration to end speech segment (for translation)
const MAX_SEGMENT_DURATION = 1.0; // Maximum segment duration in seconds (for Whisper)
const SAMPLE_RATE = 48000; // 48kHz

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("vi");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");

  // Refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const messageIdRef = useRef(0);
  const nurseScrollRef = useRef<HTMLDivElement>(null);
  const patientScrollRef = useRef<HTMLDivElement>(null);

  // Track 1: 1-second chunks for immediate subtitles
  const chunkStartTimeRef = useRef<number>(0);
  const currentChunkBufferRef = useRef<Float32Array[]>([]);

  // Track 2: VAD-based segments for translation
  const lastSpeechTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  const vadIntervalRef = useRef<number | null>(null);
  const sentenceBufferRef = useRef<Float32Array[]>([]);

  // tRPC mutations
  const translateMutation = trpc.translation.autoTranslate.useMutation();
  const ttsMutation = trpc.tts.generate.useMutation();

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

  // Process 1-second chunk for immediate subtitle
  const processChunkForSubtitle = useCallback(async (pcmBuffer: Float32Array[]) => {
    if (pcmBuffer.length === 0) return;

    console.log(`[Subtitle] Processing chunk with ${pcmBuffer.length} PCM buffers`);
    setProcessingStatus("recognizing");

    try {
      // Concatenate PCM buffers
      const totalLength = pcmBuffer.reduce((acc, buf) => acc + buf.length, 0);
      const concatenated = new Float32Array(totalLength);
      let offset = 0;
      for (const buf of pcmBuffer) {
        concatenated.set(buf, offset);
        offset += buf.length;
      }

      // Create AudioBuffer
      const audioBuffer = audioContextRef.current!.createBuffer(1, concatenated.length, SAMPLE_RATE);
      audioBuffer.copyToChannel(concatenated, 0);

      // Convert to WebM using MediaRecorder
      const tempContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      const source = tempContext.createBufferSource();
      source.buffer = audioBuffer;
      const dest = tempContext.createMediaStreamDestination();
      source.connect(dest);
      source.start();

      const mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 48000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(chunks, { type: "audio/webm" });
        console.log(`[Subtitle] Created WebM blob, size: ${webmBlob.size} bytes`);

        // Convert to base64 and send to Whisper
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];

          try {
            const result = await translateMutation.mutateAsync({
              audioBase64: base64Audio,
              filename: `subtitle-${Date.now()}.webm`,
              preferredTargetLang: targetLanguage,
            });

            if (result.success && result.sourceText) {
              // Display subtitle immediately
              setCurrentSubtitle(result.sourceText);
              console.log(`[Subtitle] ${result.sourceText}`);
            }
          } catch (error: any) {
            console.error("[Subtitle] Error:", error);
          } finally {
            setProcessingStatus("listening");
          }
        };
        reader.readAsDataURL(webmBlob);
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), (audioBuffer.length / SAMPLE_RATE) * 1000 + 100);
    } catch (error: any) {
      console.error("[Subtitle] Error:", error);
      setProcessingStatus("listening");
    }
  }, [targetLanguage, translateMutation]);

  // Process VAD-based sentence for translation
  const processSentenceForTranslation = useCallback(async (pcmBuffer: Float32Array[]) => {
    if (pcmBuffer.length === 0) return;

    console.log(`[Translation] Processing sentence with ${pcmBuffer.length} PCM buffers`);
    setProcessingStatus("translating");

    try {
      // Concatenate PCM buffers
      const totalLength = pcmBuffer.reduce((acc, buf) => acc + buf.length, 0);
      const concatenated = new Float32Array(totalLength);
      let offset = 0;
      for (const buf of pcmBuffer) {
        concatenated.set(buf, offset);
        offset += buf.length;
      }

      // Create AudioBuffer
      const audioBuffer = audioContextRef.current!.createBuffer(1, concatenated.length, SAMPLE_RATE);
      audioBuffer.copyToChannel(concatenated, 0);

      // Convert to WebM using MediaRecorder
      const tempContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      const source = tempContext.createBufferSource();
      source.buffer = audioBuffer;
      const dest = tempContext.createMediaStreamDestination();
      source.connect(dest);
      source.start();

      const mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 48000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(chunks, { type: "audio/webm" });
        console.log(`[Translation] Created WebM blob, size: ${webmBlob.size} bytes`);

        // Convert to base64 and send for translation
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];

          try {
            const result = await translateMutation.mutateAsync({
              audioBase64: base64Audio,
              filename: `translation-${Date.now()}.webm`,
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
              setCurrentSubtitle(""); // Clear subtitle after translation
              console.log(`[Translation] Added message:`, newMessage);

              // Play TTS audio
              setProcessingStatus("speaking");
              try {
                const ttsResult = await ttsMutation.mutateAsync({
                  text: result.translatedText,
                  language: result.targetLang || "vi",
                });

                if (ttsResult.success && ttsResult.audioBase64) {
                  const audioBlob = new Blob(
                    [Uint8Array.from(atob(ttsResult.audioBase64), (c) => c.charCodeAt(0))],
                    { type: "audio/mp3" }
                  );
                  const audioUrl = URL.createObjectURL(audioBlob);
                  const audio = new Audio(audioUrl);
                  audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    setProcessingStatus("listening");
                  };
                  await audio.play();
                  console.log(`[TTS] Playing audio for: "${result.translatedText}"`);
                } else {
                  console.error("[TTS] Failed:", ttsResult.error);
                  setProcessingStatus("listening");
                }
              } catch (ttsError: any) {
                console.error("[TTS] Error:", ttsError);
                setProcessingStatus("listening");
              }
            } else {
              console.error("[Translation] Translation failed:", result.error);
              if (result.error && !result.error.includes("No speech detected")) {
                toast.error(result.error);
              }
            }
          } catch (error: any) {
            console.error("[Translation] Error:", error);
            toast.error("處理語音時發生錯誤");
          } finally {
            setProcessingStatus("listening");
          }
        };
        reader.readAsDataURL(webmBlob);
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), (audioBuffer.length / SAMPLE_RATE) * 1000 + 100);
    } catch (error: any) {
      console.error("[Translation] Error:", error);
      toast.error("處理語音時發生錯誤");
      setProcessingStatus("listening");
    }
  }, [targetLanguage, translateMutation]);

  // Start VAD monitoring
  const startVADMonitoring = useCallback(() => {
    if (vadIntervalRef.current !== null) return;

    console.log("[VAD] Started VAD monitoring");
    setProcessingStatus("listening");
    chunkStartTimeRef.current = Date.now();

    vadIntervalRef.current = window.setInterval(() => {
      const isSpeaking = checkAudioLevel();
      const now = Date.now();

      // Track 1: 1-second chunks for subtitles
      const chunkDuration = (now - chunkStartTimeRef.current) / 1000;
      if (chunkDuration >= MAX_SEGMENT_DURATION) {
        // Process 1-second chunk for subtitle
        if (currentChunkBufferRef.current.length > 0) {
          processChunkForSubtitle([...currentChunkBufferRef.current]);
          currentChunkBufferRef.current = [];
        }
        chunkStartTimeRef.current = now;
      }

      // Track 2: VAD-based segments for translation
      if (isSpeaking) {
        lastSpeechTimeRef.current = now;
        if (!isSpeakingRef.current) {
          // Speech segment start
          isSpeakingRef.current = true;
          setProcessingStatus("vad-detected");
          console.log(`🔵 Speech started`);
        }
      } else {
        if (isSpeakingRef.current) {
          const silenceDuration = now - lastSpeechTimeRef.current;
          if (silenceDuration >= SILENCE_DURATION_MS) {
            // Speech segment end
            isSpeakingRef.current = false;
            setProcessingStatus("listening");
            console.log(`🟢 Speech ended (silence: ${silenceDuration}ms), processing translation...`);

            // Process sentence for translation
            if (sentenceBufferRef.current.length > 0) {
              processSentenceForTranslation([...sentenceBufferRef.current]);
              sentenceBufferRef.current = [];
            }
          }
        }
      }
    }, 100);
  }, [checkAudioLevel, processChunkForSubtitle, processSentenceForTranslation]);

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
          sampleRate: SAMPLE_RATE,
        },
      });
      streamRef.current = stream;

      // Setup Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      const source = audioContext.createMediaStreamSource(stream);

      // Setup analyser for VAD
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Setup AudioWorklet
      await audioContext.audioWorklet.addModule("/audio-processor.js");
      const audioWorkletNode = new AudioWorkletNode(audioContext, "audio-capture-processor");

      audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === "audioData") {
          // Collect PCM data for both tracks
          currentChunkBufferRef.current.push(event.data.data);
          if (isSpeakingRef.current) {
            sentenceBufferRef.current.push(event.data.data);
          }
        }
      };

      source.connect(audioWorkletNode);
      audioWorkletNode.connect(audioContext.destination);

      audioWorkletNodeRef.current = audioWorkletNode;

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

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear buffers
    currentChunkBufferRef.current = [];
    sentenceBufferRef.current = [];
    isSpeakingRef.current = false;
    setAudioLevel(0);
    setCurrentSubtitle("");
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
          {currentSubtitle && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">即時字幕:</span>
              <span className="text-white">{currentSubtitle}</span>
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
