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

// VAD 設定
const VAD_THRESHOLD = 0.01; // 音量閾值（0-1），低於此值視為靜音
const VAD_SAMPLE_RATE = 100; // 取樣頻率（ms）

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("vi"); // Default to Vietnamese
  const [audioLevel, setAudioLevel] = useState<number>(0); // 即時音量 (0-1)
  const [hasVoiceActivity, setHasVoiceActivity] = useState<boolean>(false); // 是否偵測到語音

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messageIdRef = useRef(0);
  
  // VAD 相關 refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);

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
      } else if (data.error) {
        console.log("Translation error:", data.error);
      }
    },
    onError: (error) => {
      toast.error("翻譯失敗：" + error.message);
    },
  });

  // VAD: 分析音量
  const analyzeAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // 計算平均音量
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255; // 正規化到 0-1

    setAudioLevel(normalizedLevel);
    setHasVoiceActivity(normalizedLevel > VAD_THRESHOLD);
  }, []);

  const processAudioChunk = useCallback((audioBlob: Blob, hadVoiceActivity: boolean) => {
    // VAD: 只處理有語音活動的片段
    if (!hadVoiceActivity) {
      console.log("No voice activity detected, skipping...");
      return;
    }

    // Check if audio blob has content
    if (audioBlob.size < 1000) {
      console.log("Audio chunk too small, skipping...");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = (reader.result as string).split(",")[1];
      if (base64Audio) {
        autoTranslateMutation.mutate({
          audioBase64: base64Audio,
          filename: `audio-${Date.now()}.webm`,
          preferredTargetLang: targetLanguage, // Pass user's language preference
        });
      }
    };
    reader.readAsDataURL(audioBlob);
  }, [autoTranslateMutation, targetLanguage]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 初始化 AudioContext 用於 VAD
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // 啟動 VAD 分析
      const vadInterval = window.setInterval(analyzeAudioLevel, VAD_SAMPLE_RATE);
      vadIntervalRef.current = vadInterval;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      let chunkHadVoiceActivity = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          processAudioChunk(audioBlob, chunkHadVoiceActivity);
        }
        audioChunksRef.current = [];
        chunkHadVoiceActivity = false;
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Record in 3-second chunks (longer for better quality)
      const intervalId = window.setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          // 記錄這個片段是否有語音活動
          chunkHadVoiceActivity = hasVoiceActivity;
          
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, 3000);

      recordingIntervalRef.current = intervalId;
      toast.success("開始對話");
    } catch (error) {
      toast.error("無法啟動麥克風：" + (error as Error).message);
    }
  }, [processAudioChunk, analyzeAudioLevel, hasVoiceActivity]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (vadIntervalRef.current) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
    setHasVoiceActivity(false);
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
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      if (vadIntervalRef.current) {
        window.clearInterval(vadIntervalRef.current);
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
        <p className="text-center text-white/60 mb-8">
          點擊「開始對話」後，系統將持續偵測語音並即時翻譯
        </p>

        {/* 音量指示器 */}
        {isRecording && (
          <div className="mb-6 flex items-center justify-center gap-4">
            <span className="text-sm text-white/60">音量:</span>
            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hasVoiceActivity ? "bg-green-500" : "bg-white/30"
                }`}
                style={{ width: `${audioLevel * 100}%` }}
              />
            </div>
            <span className="text-sm text-white/60">
              {hasVoiceActivity ? "偵測到語音" : "靜音"}
            </span>
          </div>
        )}

        {/* Conversation Display */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* 台灣人 (中文) */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-center">台灣人 (中文)</h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
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
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
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
