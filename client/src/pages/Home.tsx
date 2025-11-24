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

type TranslationResult = {
  success: boolean;
  direction?: "nurse_to_patient" | "patient_to_nurse";
  sourceLang?: string;
  targetLang?: string;
  sourceText?: string;
  translatedText?: string;
  error?: string;
};

type ProcessingStatus = "listening" | "recognizing" | "translating" | "idle";

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

// VAD 設定（使用 RMS 音量檢測）
const RMS_THRESHOLD = 0.02; // RMS 閾值
const SILENCE_FRAMES_THRESHOLD = 10; // 約 800ms 靜音判定為語音結束
const AUDIO_PROCESS_BUFFER_SIZE = 4096;

// WAV 編碼函數
function encodeWAV(samples: Float32Array[], sampleRate: number): Blob {
  const length = samples.reduce((acc, arr) => acc + arr.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length * 2, true);

  let offset = 44;
  let index = 0;
  for (const sample of samples) {
    for (let i = 0; i < sample.length; i++, offset += 2, index++) {
      const s = Math.max(-1, Math.min(1, sample[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

// RMS 音量檢測
function isSpeaking(audioArray: Float32Array): boolean {
  let sum = 0;
  for (let i = 0; i < audioArray.length; i++) {
    sum += audioArray[i] * audioArray[i];
  }
  const rms = Math.sqrt(sum / audioArray.length);
  return rms > RMS_THRESHOLD;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("vi");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messageIdRef = useRef(0);
  
  // Refs for auto-scroll
  const nurseScrollRef = useRef<HTMLDivElement>(null);
  const patientScrollRef = useRef<HTMLDivElement>(null);

  // VAD 狀態
  const currentSpeechBufferRef = useRef<Float32Array[]>([]);
  const speakingRef = useRef(false);
  const silenceFramesRef = useRef(0);

  const autoTranslateMutation = trpc.translation.autoTranslate.useMutation({
    onSuccess: (data: TranslationResult) => {
      if (data.success && data.sourceText && data.translatedText) {
        const speaker = data.direction === "nurse_to_patient" ? "nurse" : "patient";

        const newMessage: ConversationMessage = {
          id: messageIdRef.current++,
          speaker,
          originalText: data.sourceText,
          translatedText: data.translatedText,
          detectedLanguage: data.sourceLang || "unknown",
          timestamp: new Date(),
        };

        setConversations((prev) => [...prev, newMessage]);
        setProcessingStatus("listening");
        
        // Auto-scroll to latest message
        setTimeout(() => {
          if (speaker === "nurse" && nurseScrollRef.current) {
            nurseScrollRef.current.scrollTop = nurseScrollRef.current.scrollHeight;
          } else if (speaker === "patient" && patientScrollRef.current) {
            patientScrollRef.current.scrollTop = patientScrollRef.current.scrollHeight;
          }
        }, 100);
      } else if (data.error) {
        console.log("Translation error:", data.error);
        setProcessingStatus("listening");
      }
    },
    onError: (error) => {
      toast.error("翻譯失敗：" + error.message);
      setProcessingStatus("listening");
    },
  });

  const sendToWhisper = useCallback(
    (audioBlob: Blob) => {
      setProcessingStatus("recognizing");

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = (reader.result as string).split(",")[1];
        if (base64Audio) {
          setProcessingStatus("translating");
          autoTranslateMutation.mutate({
            audioBase64: base64Audio,
            filename: `audio-${Date.now()}.wav`,
            preferredTargetLang: targetLanguage,
          });
        }
      };
      reader.readAsDataURL(audioBlob);
    },
    [autoTranslateMutation, targetLanguage]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(AUDIO_PROCESS_BUFFER_SIZE, 1, 1);

      audioContextRef.current = audioContext;
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        const dataCopy = new Float32Array(data);

        // 計算 RMS 並更新音量顯示
        let sum = 0;
        for (let i = 0; i < dataCopy.length; i++) {
          sum += dataCopy[i] * dataCopy[i];
        }
        const rms = Math.sqrt(sum / dataCopy.length);
        setAudioLevel(rms / RMS_THRESHOLD); // 正規化顯示

        // VAD 判斷
        if (isSpeaking(dataCopy)) {
          speakingRef.current = true;
          silenceFramesRef.current = 0;
          currentSpeechBufferRef.current.push(dataCopy);
        } else {
          if (speakingRef.current) {
            silenceFramesRef.current++;
            if (silenceFramesRef.current > SILENCE_FRAMES_THRESHOLD) {
              // 語音結束，發送到 Whisper
              speakingRef.current = false;
              const wavBlob = encodeWAV(
                currentSpeechBufferRef.current,
                audioContext.sampleRate
              );
              
              // 檢查 WAV 大小
              if (wavBlob.size > 1000) {
                sendToWhisper(wavBlob);
              } else {
                console.log("Speech too short, skipping...");
              }

              currentSpeechBufferRef.current = [];
              silenceFramesRef.current = 0;
            }
          }
        }
      };

      setIsRecording(true);
      setProcessingStatus("listening");
      toast.success("開始對話");
    } catch (error) {
      toast.error("無法啟動麥克風：" + (error as Error).message);
    }
  }, [sendToWhisper]);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    currentSpeechBufferRef.current = [];
    speakingRef.current = false;
    silenceFramesRef.current = 0;

    setIsRecording(false);
    setAudioLevel(0);
    setProcessingStatus("idle");
    toast.success("結束對話");
  }, []);

  const clearConversations = useCallback(() => {
    setConversations([]);
    messageIdRef.current = 0;
    toast.success("已清除對話記錄");
  }, []);

  const exportConversations = useCallback(() => {
    if (conversations.length === 0) {
      toast.error("沒有對話記錄可匯出");
      return;
    }

    const content = conversations
      .map((msg) => {
        const speaker = msg.speaker === "nurse" ? "台灣人" : "外國人";
        const time = msg.timestamp.toLocaleTimeString("zh-TW");
        return `[${time}] ${speaker}\n原文: ${msg.originalText}\n譯文: ${msg.translatedText}\n`;
      })
      .join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translation-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("對話記錄已匯出");
  }, [conversations]);

  useEffect(() => {
    return () => {
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getLanguageLabel = (code: string) => {
    const lang = LANGUAGE_OPTIONS.find((l) => l.value === code);
    return lang ? lang.label : code;
  };

  const getStatusMessage = () => {
    switch (processingStatus) {
      case "listening":
        return "🟢 等待說話...";
      case "recognizing":
        return "🟡 正在辨識語音...";
      case "translating":
        return "🟣 正在翻譯...";
      default:
        return "";
    }
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

        {/* 處理狀態指示器 */}
        {processingStatus !== "idle" && (
          <div className="fixed top-20 right-6 bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg border border-white/20 text-lg">
            {getStatusMessage()}
          </div>
        )}

        {/* 音量指示器 */}
        {isRecording && (
          <div className="mb-6 flex items-center justify-center gap-4">
            <span className="text-sm text-white/60">音量:</span>
            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  speakingRef.current ? "bg-green-500" : "bg-white/30"
                }`}
                style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              />
            </div>
            <span className="text-sm text-white/60">
              {speakingRef.current ? "偵測到語音" : "靜音"}
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
              variant="destructive"
              className="px-8 py-6 text-lg"
            >
              結束對話
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
