import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Mic, MicOff } from "lucide-react";
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
  timestamp: Date;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);

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
        });
      }
    };
    reader.readAsDataURL(audioBlob);
  }, [autoTranslateMutation]);

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
        <h1 className="text-white text-2xl font-bold mb-2">護理推車即時雙向翻譯系統</h1>
        <p className="text-white/60 text-sm">
          點擊「開始對話」後，系統將持續識別語言並即時翻譯
        </p>
      </div>

      {/* Conversation Display */}
      <div className="flex-1 flex items-center justify-center mt-24 mb-24">
        <div className="w-full max-w-6xl grid grid-cols-2 gap-8">
          {/* Nurse Side (Left) */}
          <div className="flex flex-col space-y-4">
            <h2 className="text-white text-xl font-bold text-center mb-4">護理師 (中文)</h2>
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

          {/* Patient Side (Right) */}
          <div className="flex flex-col space-y-4">
            <h2 className="text-white text-xl font-bold text-center mb-4">病患 (外語)</h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {conversations
                .filter((msg) => msg.speaker === "patient")
                .map((msg) => (
                  <div key={msg.id} className="bg-white/10 backdrop-blur-md rounded-lg p-4">
                    <p className="text-white text-lg font-medium mb-2">{msg.originalText}</p>
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
