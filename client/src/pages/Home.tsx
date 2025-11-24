import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, Languages, Mic, MicOff, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface TranslationResult {
  success: boolean;
  direction?: "nurse_to_patient" | "patient_to_nurse";
  sourceLang?: string;
  targetLang?: string;
  sourceText?: string;
  translatedText?: string;
  audioUrl?: string;
  error?: string;
}

interface ConversationMessage {
  id: number;
  speaker: "nurse" | "patient";
  originalText: string;
  translatedText: string;
  detectedLanguage?: string;
  timestamp: Date;
}

const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "越南語" },
  { code: "id", name: "印尼語" },
  { code: "tl", name: "菲律賓語" },
  { code: "en", name: "英文" },
  { code: "it", name: "義大利語" },
  { code: "ja", name: "日文" },
  { code: "ko", name: "韓文" },
  { code: "th", name: "泰文" },
];

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("vi"); // Default to Vietnamese

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messageIdRef = useRef(0);

  const autoTranslateMutation = trpc.translation.autoTranslate.useMutation({
    onSuccess: (data: TranslationResult) => {
      if (data.success && data.sourceText && data.translatedText) {
        const speaker = data.direction === "nurse_to_patient" ? "nurse" : "patient";
        
        const newMessage: ConversationMessage = {
          id: messageIdRef.current++,
          speaker,
          originalText: data.sourceText,
          translatedText: data.translatedText,
          detectedLanguage: data.sourceLang,
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

  const processAudioChunk = useCallback((audioBlob: Blob) => {
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

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          processAudioChunk(audioBlob);
        }
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Record in 2-second chunks
      const intervalId = window.setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, 2000);

      recordingIntervalRef.current = intervalId;
      toast.success("開始對話");
    } catch (error) {
      toast.error("無法啟動麥克風：" + (error as Error).message);
    }
  }, [processAudioChunk]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    setIsRecording(false);
    toast.info("結束對話");
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

    const languageNames: Record<string, string> = {
      zh: "中文",
      "zh-tw": "繁體中文",
      vi: "越南語",
      id: "印尼語",
      tl: "他加祿語",
      fil: "菲律賓語",
      en: "英文",
      it: "義大利語",
      ja: "日文",
      ko: "韓文",
      th: "泰文",
    };

    let content = "即時雙向翻譯系統 - 對話記錄\n";
    content += "=" + "=".repeat(50) + "\n\n";

    conversations.forEach((msg, index) => {
      const speaker = msg.speaker === "nurse" ? "台灣人" : "外國人";
      const lang = msg.detectedLanguage ? languageNames[msg.detectedLanguage] || msg.detectedLanguage : "";
      const time = msg.timestamp.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });

      content += `[${index + 1}] ${speaker}${lang ? ` (${lang})` : ""} - ${time}\n`;
      content += `原文：${msg.originalText}\n`;
      content += `譯文：${msg.translatedText}\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `對話記錄_${new Date().toISOString().split("T")[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("對話記錄已下載");
  }, [conversations]);

  const getLanguageName = (langCode?: string): string => {
    if (!langCode) return "";
    const languageNames: Record<string, string> = {
      zh: "中文",
      "zh-tw": "繁體中文",
      vi: "越南語",
      id: "印尼語",
      tl: "他加祿語",
      fil: "菲律賓語",
      en: "英文",
      it: "義大利語",
      ja: "日文",
      ko: "韓文",
      th: "泰文",
    };
    return languageNames[langCode] || langCode;
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-black/30 backdrop-blur-sm flex flex-col p-8 relative">
      {/* Header */}
      <div className="fixed top-8 left-1/2 transform -translate-x-1/2 text-center z-10">
        <h1 className="text-white text-2xl font-bold mb-2">即時雙向翻譯系統</h1>
        <p className="text-white/60 text-sm">
          點擊「開始對話」後，系統將持續識別語言並即時翻譯
        </p>
      </div>

      {/* Language Selector (top left) */}
      <div className="fixed top-8 left-8 z-10">
        <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md rounded-lg px-4 py-2">
          <Languages className="w-5 h-5 text-white" />
          <span className="text-white text-sm">目標語言：</span>
          <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isRecording}>
            <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action buttons (top right) */}
      <div className="fixed top-8 right-8 flex space-x-2 z-10">
        <Button
          onClick={exportConversations}
          variant="outline"
          size="sm"
          className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          disabled={conversations.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          匯出
        </Button>
        <Button
          onClick={clearConversations}
          variant="outline"
          size="sm"
          className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          disabled={conversations.length === 0}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          清除
        </Button>
      </div>

      {/* Conversation Display */}
      <div className="flex-1 flex items-center justify-center mt-24 mb-24">
        <div className="w-full max-w-6xl grid grid-cols-2 gap-8">
          {/* Taiwanese Side (Left) */}
          <div className="flex flex-col space-y-4">
            <h2 className="text-white text-xl font-bold text-center mb-4">台灣人 (中文)</h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {conversations
                .filter((msg) => msg.speaker === "nurse")
                .map((msg) => (
                  <div key={msg.id} className="bg-white/10 backdrop-blur-md rounded-lg p-4">
                    <p className="text-white text-lg font-medium mb-2">{msg.originalText}</p>
                    <p className="text-white/70 text-sm">→ {msg.translatedText}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* Foreigner Side (Right) */}
          <div className="flex flex-col space-y-4">
            <h2 className="text-white text-xl font-bold text-center mb-4">外國人 (外語)</h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {conversations
                .filter((msg) => msg.speaker === "patient")
                .map((msg) => (
                  <div key={msg.id} className="bg-white/10 backdrop-blur-md rounded-lg p-4 relative">
                    {msg.detectedLanguage && (
                      <span className="absolute top-2 right-2 text-xs bg-blue-500/80 text-white px-2 py-1 rounded">
                        {getLanguageName(msg.detectedLanguage)}
                      </span>
                    )}
                    <p className="text-white text-lg font-medium mb-2 pr-16">{msg.originalText}</p>
                    <p className="text-white/70 text-sm">→ {msg.translatedText}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {autoTranslateMutation.isPending && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-md rounded-lg px-6 py-3">
          <span className="text-white text-lg">處理中...</span>
        </div>
      )}

      {/* Control buttons */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4 z-10">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-xl rounded-full shadow-lg"
          >
            <Mic className="w-8 h-8 mr-2" />
            開始對話
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-xl rounded-full shadow-lg animate-pulse"
          >
            <MicOff className="w-8 h-8 mr-2" />
            結束對話
          </Button>
        )}
      </div>
    </div>
  );
}
