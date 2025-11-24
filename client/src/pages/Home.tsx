import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [primaryText, setPrimaryText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");
  const [currentDirection, setCurrentDirection] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const autoTranslateMutation = trpc.translation.autoTranslate.useMutation({
    onSuccess: (data: TranslationResult) => {
      if (data.success && data.sourceText && data.translatedText) {
        // Update subtitles based on direction
        if (data.direction === "nurse_to_patient") {
          // Primary: Patient language (target), Secondary: Chinese (source)
          setPrimaryText(data.translatedText);
          setSecondaryText(data.sourceText);
          setCurrentDirection("護理師 → 病患");
        } else {
          // Primary: Chinese (target), Secondary: Patient language (source)
          setPrimaryText(data.translatedText);
          setSecondaryText(data.sourceText);
          setCurrentDirection("病患 → 護理師");
        }

        // Play TTS audio
        if (data.audioUrl && audioRef.current) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.play().catch((err) => {
            console.error("Audio playback failed:", err);
          });
        }
      } else if (data.error) {
        console.log("Translation error:", data.error);
      }
    },
    onError: (error) => {
      toast.error("翻譯失敗：" + error.message);
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          
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
        }
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Record in 2-second chunks
      recordingIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, 2000);

      toast.success("開始錄音");
    } catch (error) {
      toast.error("無法啟動麥克風：" + (error as Error).message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    setIsRecording(false);
    toast.info("停止錄音");
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center p-8 relative">
      {/* Audio element for TTS playback */}
      <audio ref={audioRef} className="hidden" />

      {/* Main subtitle display area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl space-y-8">
        {/* Direction indicator */}
        {currentDirection && (
          <div className="text-white/60 text-lg font-medium mb-4">
            {currentDirection}
          </div>
        )}

        {/* Primary subtitle (large) */}
        <div className="text-center">
          <p className="text-white text-5xl font-bold leading-tight min-h-[120px] flex items-center justify-center">
            {primaryText || "等待語音輸入..."}
          </p>
        </div>

        {/* Secondary subtitle (small) */}
        {secondaryText && (
          <div className="text-center">
            <p className="text-white/70 text-3xl leading-relaxed">
              {secondaryText}
            </p>
          </div>
        )}

        {/* Loading indicator */}
        {autoTranslateMutation.isPending && (
          <div className="flex items-center space-x-2 text-white/60">
            <Volume2 className="w-5 h-5 animate-pulse" />
            <span className="text-lg">處理中...</span>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-xl rounded-full shadow-lg"
          >
            <Mic className="w-8 h-8 mr-2" />
            開始錄音
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-xl rounded-full shadow-lg animate-pulse"
          >
            <MicOff className="w-8 h-8 mr-2" />
            停止錄音
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="fixed top-8 left-1/2 transform -translate-x-1/2 text-center">
        <h1 className="text-white text-2xl font-bold mb-2">護理推車即時雙向翻譯系統</h1>
        <p className="text-white/60 text-sm">
          點擊「開始錄音」後，系統將自動識別語言並進行翻譯
        </p>
      </div>
    </div>
  );
}
