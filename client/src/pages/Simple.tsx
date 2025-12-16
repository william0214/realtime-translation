import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getASRModeConfig } from "../../../shared/config";

// 支援的語言列表
const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "越南語", flag: "🇻🇳" },
  { code: "id", name: "印尼語", flag: "🇮🇩" },
  { code: "tl", name: "菲律賓語", flag: "🇵🇭" },
  { code: "en", name: "英文", flag: "🇺🇸" },
  { code: "it", name: "義大利語", flag: "🇮🇹" },
  { code: "ja", name: "日文", flag: "🇯🇵" },
  { code: "ko", name: "韓文", flag: "🇰🇷" },
  { code: "th", name: "泰文", flag: "🇹🇭" },
];

// 訊息類型
interface Message {
  id: number;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  status: "partial" | "final" | "translated";
}

// 音訊設定
const SAMPLE_RATE = 48000;

export default function Simple() {
  // 狀態管理
  const [targetLanguage, setTargetLanguage] = useState("vi");
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [processingStatus, setProcessingStatus] = useState<"idle" | "listening" | "recognizing" | "translating">("idle");
  
  // Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sentenceBufferRef = useRef<Float32Array[]>([]);
  const isSpeakingRef = useRef(false);
  const speechStartTimeRef = useRef<number>(0);
  const silenceStartTimeRef = useRef<number>(0);
  const partialMessageIdRef = useRef<number | null>(null);
  const lastPartialTimeRef = useRef<number>(0);
  const sentenceEndTriggeredRef = useRef(false);
  const messageIdCounterRef = useRef(0);
  const vadIntervalRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // tRPC mutation
  const translateMutation = trpc.translation.autoTranslate.useMutation();

  // VAD 配置
  const config = getASRModeConfig("normal");
  const RMS_THRESHOLD = config.rmsThreshold;
  const MIN_SPEECH_DURATION_MS = config.minSpeechDurationMs;
  const SILENCE_DURATION_MS = config.silenceDurationMs;
  const PARTIAL_CHUNK_INTERVAL_MS = config.partialChunkIntervalMs;

  // 自動滾動到最新訊息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 處理 partial transcript（即時字幕）
  const processPartialChunk = useCallback(async (pcmBuffer: Float32Array[]) => {
    if (pcmBuffer.length < 12) {
      console.log(`⚠️ [Partial] Buffer too short (${pcmBuffer.length} buffers < 12), skipping`);
      return;
    }

    // 合併 PCM buffer
    const totalLength = pcmBuffer.reduce((acc, buf) => acc + buf.length, 0);
    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of pcmBuffer) {
      concatenated.set(buf, offset);
      offset += buf.length;
    }

    // 轉換為 WAV
    const wavBuffer = encodeWAV(concatenated, SAMPLE_RATE);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    
    // 轉換為 base64
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(",")[1];
      
      try {
        const result = await translateMutation.mutateAsync({
          audioBase64: base64Audio,
          filename: `partial-${Date.now()}.wav`,
          preferredTargetLang: targetLanguage,
          forceSourceLang: "zh", // 強制中文識別
          forceSpeaker: "nurse",
          transcriptOnly: true, // 只做語音識別，不翻譯
          asrMode: "normal",
        });

        if (result.success && result.sourceText) {
          // 更新 partial 訊息
          if (partialMessageIdRef.current !== null) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === partialMessageIdRef.current
                  ? { ...msg, originalText: result.sourceText || "" }
                  : msg
              )
            );
          }
        }
      } catch (error) {
        console.error("[Partial] Error:", error);
      }
    };
  }, [targetLanguage, translateMutation]);

  // 處理 final transcript（完整翻譯）
  const processFinalTranscript = useCallback(async (pcmBuffer: Float32Array[]) => {
    if (pcmBuffer.length < 12) {
      console.log(`⚠️ [Final] Buffer too short (${pcmBuffer.length} buffers < 12), skipping`);
      setProcessingStatus("listening");
      return;
    }

    setProcessingStatus("recognizing");

    // 只取最後 70 個 buffer（約 1.5 秒）
    const MAX_FINAL_BUFFERS = 70;
    const finalBuffers = pcmBuffer.slice(-MAX_FINAL_BUFFERS);

    // 合併 PCM buffer
    const totalLength = finalBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of finalBuffers) {
      concatenated.set(buf, offset);
      offset += buf.length;
    }

    // 轉換為 WAV
    const wavBuffer = encodeWAV(concatenated, SAMPLE_RATE);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    
    // 轉換為 base64
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(",")[1];
      
      try {
        setProcessingStatus("translating");
        
        const result = await translateMutation.mutateAsync({
          audioBase64: base64Audio,
          filename: `final-${Date.now()}.wav`,
          preferredTargetLang: targetLanguage,
          forceSourceLang: "zh", // 強制中文識別
          forceSpeaker: "nurse",
          transcriptOnly: false, // 完整翻譯
          asrMode: "normal",
        });

        if (result.success && result.sourceText) {
          // 更新 partial 訊息為 final
          if (partialMessageIdRef.current !== null) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === partialMessageIdRef.current
                  ? { 
                      ...msg, 
                      originalText: result.sourceText || "", 
                      translatedText: result.translatedText || "",
                      status: "translated" as const,
                      timestamp: new Date() 
                    }
                  : msg
              )
            );
            console.log(`[Final] Updated message #${partialMessageIdRef.current}: "${result.sourceText}" → "${result.translatedText}"`);
          } else {
            // 沒有 partial 訊息，創建新的
            const newId = ++messageIdCounterRef.current;
            setMessages((prev) => [
              ...prev,
              {
                id: newId,
                originalText: result.sourceText || "",
                translatedText: result.translatedText || "",
                timestamp: new Date(),
                status: "translated",
              },
            ]);
            console.log(`[Final] Created new message #${newId}: "${result.sourceText}" → "${result.translatedText}"`);
          }
          
          partialMessageIdRef.current = null;
        } else {
          // 翻譯失敗，移除 partial 訊息
          if (partialMessageIdRef.current !== null) {
            setMessages((prev) => prev.filter((msg) => msg.id !== partialMessageIdRef.current));
            partialMessageIdRef.current = null;
          }
          
          if (result.error && !result.error.includes("No speech detected")) {
            toast.error(`❌ 翻譯失敗: ${result.error}`);
          }
        }
      } catch (error) {
        console.error("[Final] Error:", error);
        toast.error("翻譯發生錯誤");
        
        // 移除 partial 訊息
        if (partialMessageIdRef.current !== null) {
          setMessages((prev) => prev.filter((msg) => msg.id !== partialMessageIdRef.current));
          partialMessageIdRef.current = null;
        }
      } finally {
        setProcessingStatus("listening");
      }
    };
  }, [targetLanguage, translateMutation]);

  // 檢查音量等級（VAD）
  const checkAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // 計算 RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    const now = Date.now();
    const isSpeaking = rms > RMS_THRESHOLD;

    if (isSpeaking) {
      if (!isSpeakingRef.current) {
        // 語音開始
        isSpeakingRef.current = true;
        speechStartTimeRef.current = now;
        sentenceEndTriggeredRef.current = false;
        sentenceBufferRef.current = [];
        
        // 創建 partial 訊息
        const newId = ++messageIdCounterRef.current;
        partialMessageIdRef.current = newId;
        setMessages((prev) => [
          ...prev,
          {
            id: newId,
            originalText: "",
            translatedText: "",
            timestamp: new Date(),
            status: "partial",
          },
        ]);
        
        console.log(`🔵 Speech started`);
      }
      silenceStartTimeRef.current = 0;

      // 處理 partial chunk
      if (now - lastPartialTimeRef.current >= PARTIAL_CHUNK_INTERVAL_MS) {
        const recentBuffers = sentenceBufferRef.current.slice(-50); // 最近 1 秒
        if (recentBuffers.length >= 12) {
          processPartialChunk(recentBuffers);
          lastPartialTimeRef.current = now;
        }
      }
    } else {
      if (isSpeakingRef.current) {
        if (silenceStartTimeRef.current === 0) {
          silenceStartTimeRef.current = now;
        }

        const silenceDuration = now - silenceStartTimeRef.current;
        const speechDuration = now - speechStartTimeRef.current;

        if (silenceDuration >= SILENCE_DURATION_MS && !sentenceEndTriggeredRef.current) {
          // 語音結束
          console.log(`🟢 Speech ended (duration: ${speechDuration}ms, silence: ${silenceDuration}ms)`);
          
          sentenceEndTriggeredRef.current = true;
          isSpeakingRef.current = false;

          if (speechDuration >= MIN_SPEECH_DURATION_MS) {
            // 處理 final transcript
            const finalBuffers = [...sentenceBufferRef.current];
            sentenceBufferRef.current = [];
            lastPartialTimeRef.current = 0;
            processFinalTranscript(finalBuffers);
          } else {
            // 語音太短，移除 partial 訊息
            console.log(`⚠️ Speech too short (${speechDuration}ms < ${MIN_SPEECH_DURATION_MS}ms), discarding`);
            if (partialMessageIdRef.current !== null) {
              setMessages((prev) => prev.filter((msg) => msg.id !== partialMessageIdRef.current));
              partialMessageIdRef.current = null;
            }
            sentenceBufferRef.current = [];
            lastPartialTimeRef.current = 0;
          }
        }
      }
    }
  }, [RMS_THRESHOLD, MIN_SPEECH_DURATION_MS, SILENCE_DURATION_MS, PARTIAL_CHUNK_INTERVAL_MS, processPartialChunk, processFinalTranscript]);

  // 開始錄音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      // 設定 analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // 載入 AudioWorklet
      await audioContext.audioWorklet.addModule("/audio-processor.js");
      const workletNode = new AudioWorkletNode(audioContext, "audio-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (isSpeakingRef.current) {
          sentenceBufferRef.current.push(new Float32Array(event.data));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      // 啟動 VAD 監控
      vadIntervalRef.current = window.setInterval(checkAudioLevel, 50);

      setIsRecording(true);
      setProcessingStatus("listening");
      toast.success("開始錄音");
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("無法啟動麥克風");
    }
  };

  // 停止錄音
  const stopRecording = () => {
    // 停止 VAD 監控
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    // 停止 AudioWorklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // 停止 AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 停止 MediaStream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 清除 partial 訊息
    setMessages((prev) => prev.filter((msg) => msg.status !== "partial"));
    partialMessageIdRef.current = null;

    // 重置狀態
    isSpeakingRef.current = false;
    sentenceBufferRef.current = [];
    lastPartialTimeRef.current = 0;
    sentenceEndTriggeredRef.current = false;

    setIsRecording(false);
    setProcessingStatus("idle");
    toast.info("停止錄音");
  };

  // 清除對話
  const clearMessages = () => {
    setMessages([]);
    messageIdCounterRef.current = 0;
  };

  // WAV 編碼函數
  function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
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
    view.setUint32(40, samples.length * 2, true);

    // PCM data
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return buffer;
  }

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // 取得目標語言名稱
  const getTargetLanguageName = () => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage);
    return lang ? `${lang.flag} ${lang.name}` : targetLanguage;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-gray-700/50 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold">
            🎙️ 簡易翻譯
          </h1>
          <div className="flex items-center gap-4">
            {/* 語言選擇 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">翻譯成：</span>
              <Select
                value={targetLanguage}
                onValueChange={setTargetLanguage}
                disabled={isRecording}
              >
                <SelectTrigger className="w-[140px] bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-6">
        {/* 狀態指示器 */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            processingStatus === "idle" ? "bg-gray-700" :
            processingStatus === "listening" ? "bg-green-700" :
            processingStatus === "recognizing" ? "bg-yellow-700" :
            "bg-blue-700"
          }`}>
            <span className={`w-3 h-3 rounded-full ${
              processingStatus === "idle" ? "bg-gray-400" :
              processingStatus === "listening" ? "bg-green-400 animate-pulse" :
              processingStatus === "recognizing" ? "bg-yellow-400 animate-pulse" :
              "bg-blue-400 animate-pulse"
            }`} />
            <span className="text-sm">
              {processingStatus === "idle" && "準備就緒"}
              {processingStatus === "listening" && "等待語音..."}
              {processingStatus === "recognizing" && "正在識別..."}
              {processingStatus === "translating" && "正在翻譯..."}
            </span>
          </div>
        </div>

        {/* 對話框 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              🇹🇼 中文 → {getTargetLanguageName()}
            </h2>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="text-gray-400 hover:text-white"
              >
                清除
              </Button>
            )}
          </div>

          {/* 訊息列表 */}
          <div className="h-[400px] md:h-[500px] overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>點擊「開始對話」並說中文，系統會自動翻譯成{getTargetLanguageName()}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl shadow-lg ${
                    msg.status === "partial"
                      ? "bg-yellow-900/30 border border-yellow-700/50"
                      : "bg-gray-700/50 border border-gray-600/50"
                  }`}
                >
                  {msg.status === "partial" ? (
                    <>
                      <div className="text-xs text-yellow-400 mb-2 flex items-center gap-2">
                        <span className="animate-pulse">●</span>
                        即時字幕
                      </div>
                      <div className="text-lg text-gray-300 italic">
                        {msg.originalText || "偵測中..."}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 原文 */}
                      <div className="text-lg md:text-xl text-white mb-3">
                        {msg.originalText}
                      </div>
                      {/* 分隔線 */}
                      <div className="border-t border-gray-600/50 my-3" />
                      {/* 翻譯 */}
                      <div className="text-lg md:text-xl text-cyan-400">
                        {msg.translatedText}
                      </div>
                      {/* 時間戳 */}
                      <div className="text-xs text-gray-500 mt-2">
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 控制按鈕 */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            className={`px-8 py-6 text-lg rounded-full ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isRecording ? "⏹️ 結束對話" : "🎤 開始對話"}
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm border-t border-gray-700/50 p-2">
        <div className="container mx-auto text-center text-xs text-gray-500">
          說中文，自動翻譯成 {getTargetLanguageName()}
        </div>
      </footer>
    </div>
  );
}
