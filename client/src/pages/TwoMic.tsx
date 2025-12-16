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
  speaker: "nurse" | "patient";
  originalText: string;
  translatedText: string;
  timestamp: Date;
  status: "partial" | "final" | "translated";
}

// 麥克風裝置類型
interface MicDevice {
  deviceId: string;
  label: string;
}

// 音訊設定
const SAMPLE_RATE = 48000;

// 單一麥克風處理器類型
interface MicProcessor {
  stream: MediaStream;
  audioContext: AudioContext;
  analyser: AnalyserNode;
  workletNode: AudioWorkletNode;
  sentenceBuffer: Float32Array[];
  isSpeaking: boolean;
  speechStartTime: number;
  silenceStartTime: number;
  lastPartialTime: number;
  sentenceEndTriggered: boolean;
  partialMessageId: number | null;
  vadInterval: number | null;
}

export default function TwoMic() {
  // 狀態管理
  const [targetLanguage, setTargetLanguage] = useState("vi");
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableMics, setAvailableMics] = useState<MicDevice[]>([]);
  const [nurseMicId, setNurseMicId] = useState<string>("");
  const [patientMicId, setPatientMicId] = useState<string>("");
  const [nurseStatus, setNurseStatus] = useState<"idle" | "listening" | "recognizing" | "translating">("idle");
  const [patientStatus, setPatientStatus] = useState<"idle" | "listening" | "recognizing" | "translating">("idle");

  // Refs
  const nurseProcessorRef = useRef<MicProcessor | null>(null);
  const patientProcessorRef = useRef<MicProcessor | null>(null);
  const messageIdCounterRef = useRef(0);
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

  // 載入可用麥克風列表
  useEffect(() => {
    const loadMicrophones = async () => {
      try {
        // 先請求權限
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices
          .filter((d) => d.kind === "audioinput")
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `麥克風 ${index + 1}`,
          }));
        
        setAvailableMics(mics);
        
        // 預設選擇前兩個麥克風
        if (mics.length >= 1 && !nurseMicId) {
          setNurseMicId(mics[0].deviceId);
        }
        if (mics.length >= 2 && !patientMicId) {
          setPatientMicId(mics[1].deviceId);
        }
      } catch (error) {
        console.error("Failed to load microphones:", error);
        toast.error("無法取得麥克風列表");
      }
    };

    loadMicrophones();

    // 監聽裝置變更
    navigator.mediaDevices.addEventListener("devicechange", loadMicrophones);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadMicrophones);
    };
  }, []);

  // WAV 編碼函數
  const encodeWAV = useCallback((samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return buffer;
  }, []);

  // 處理 partial transcript
  const processPartialChunk = useCallback(async (
    pcmBuffer: Float32Array[],
    speaker: "nurse" | "patient",
    partialMessageId: number | null
  ) => {
    if (pcmBuffer.length < 12) return;

    const totalLength = pcmBuffer.reduce((acc, buf) => acc + buf.length, 0);
    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of pcmBuffer) {
      concatenated.set(buf, offset);
      offset += buf.length;
    }

    const wavBuffer = encodeWAV(concatenated, SAMPLE_RATE);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(",")[1];

      try {
        const forceSourceLang = speaker === "nurse" ? "zh" : targetLanguage;
        
        const result = await translateMutation.mutateAsync({
          audioBase64: base64Audio,
          filename: `partial-${speaker}-${Date.now()}.wav`,
          preferredTargetLang: targetLanguage,
          forceSourceLang,
          forceSpeaker: speaker,
          transcriptOnly: true,
          asrMode: "normal",
        });

        if (result.success && result.sourceText && partialMessageId !== null) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === partialMessageId
                ? { ...msg, originalText: result.sourceText || "" }
                : msg
            )
          );
        }
      } catch (error) {
        console.error(`[Partial ${speaker}] Error:`, error);
      }
    };
  }, [targetLanguage, translateMutation, encodeWAV]);

  // 處理 final transcript
  const processFinalTranscript = useCallback(async (
    pcmBuffer: Float32Array[],
    speaker: "nurse" | "patient",
    partialMessageId: number | null,
    setStatus: (status: "idle" | "listening" | "recognizing" | "translating") => void
  ) => {
    if (pcmBuffer.length < 12) {
      setStatus("listening");
      return;
    }

    setStatus("recognizing");

    const MAX_FINAL_BUFFERS = 70;
    const finalBuffers = pcmBuffer.slice(-MAX_FINAL_BUFFERS);

    const totalLength = finalBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of finalBuffers) {
      concatenated.set(buf, offset);
      offset += buf.length;
    }

    const wavBuffer = encodeWAV(concatenated, SAMPLE_RATE);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(",")[1];

      try {
        setStatus("translating");

        const forceSourceLang = speaker === "nurse" ? "zh" : targetLanguage;

        const result = await translateMutation.mutateAsync({
          audioBase64: base64Audio,
          filename: `final-${speaker}-${Date.now()}.wav`,
          preferredTargetLang: targetLanguage,
          forceSourceLang,
          forceSpeaker: speaker,
          transcriptOnly: false,
          asrMode: "normal",
        });

        if (result.success && result.sourceText) {
          if (partialMessageId !== null) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === partialMessageId
                  ? {
                      ...msg,
                      originalText: result.sourceText || "",
                      translatedText: result.translatedText || "",
                      status: "translated" as const,
                      timestamp: new Date(),
                    }
                  : msg
              )
            );
          } else {
            const newId = ++messageIdCounterRef.current;
            setMessages((prev) => [
              ...prev,
              {
                id: newId,
                speaker,
                originalText: result.sourceText || "",
                translatedText: result.translatedText || "",
                timestamp: new Date(),
                status: "translated",
              },
            ]);
          }
        } else {
          if (partialMessageId !== null) {
            setMessages((prev) => prev.filter((msg) => msg.id !== partialMessageId));
          }
          if (result.error && !result.error.includes("No speech detected")) {
            toast.error(`❌ 翻譯失敗: ${result.error}`);
          }
        }
      } catch (error) {
        console.error(`[Final ${speaker}] Error:`, error);
        toast.error("翻譯發生錯誤");
        if (partialMessageId !== null) {
          setMessages((prev) => prev.filter((msg) => msg.id !== partialMessageId));
        }
      } finally {
        setStatus("listening");
      }
    };
  }, [targetLanguage, translateMutation, encodeWAV]);

  // 建立單一麥克風處理器
  const createMicProcessor = useCallback(async (
    deviceId: string,
    speaker: "nurse" | "patient",
    setStatus: (status: "idle" | "listening" | "recognizing" | "translating") => void
  ): Promise<MicProcessor | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      await audioContext.audioWorklet.addModule("/audio-processor.js");
      const workletNode = new AudioWorkletNode(audioContext, "audio-processor");

      const processor: MicProcessor = {
        stream,
        audioContext,
        analyser,
        workletNode,
        sentenceBuffer: [],
        isSpeaking: false,
        speechStartTime: 0,
        silenceStartTime: 0,
        lastPartialTime: 0,
        sentenceEndTriggered: false,
        partialMessageId: null,
        vadInterval: null,
      };

      // 處理音訊資料
      workletNode.port.onmessage = (event) => {
        if (processor.isSpeaking) {
          processor.sentenceBuffer.push(new Float32Array(event.data));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      // VAD 監控
      const checkAudioLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        const now = Date.now();
        const isSpeaking = rms > RMS_THRESHOLD;

        if (isSpeaking) {
          if (!processor.isSpeaking) {
            processor.isSpeaking = true;
            processor.speechStartTime = now;
            processor.sentenceEndTriggered = false;
            processor.sentenceBuffer = [];

            const newId = ++messageIdCounterRef.current;
            processor.partialMessageId = newId;
            setMessages((prev) => [
              ...prev,
              {
                id: newId,
                speaker,
                originalText: "",
                translatedText: "",
                timestamp: new Date(),
                status: "partial",
              },
            ]);

            console.log(`🔵 [${speaker}] Speech started`);
          }
          processor.silenceStartTime = 0;

          if (now - processor.lastPartialTime >= PARTIAL_CHUNK_INTERVAL_MS) {
            const recentBuffers = processor.sentenceBuffer.slice(-50);
            if (recentBuffers.length >= 12) {
              processPartialChunk(recentBuffers, speaker, processor.partialMessageId);
              processor.lastPartialTime = now;
            }
          }
        } else {
          if (processor.isSpeaking) {
            if (processor.silenceStartTime === 0) {
              processor.silenceStartTime = now;
            }

            const silenceDuration = now - processor.silenceStartTime;
            const speechDuration = now - processor.speechStartTime;

            if (silenceDuration >= SILENCE_DURATION_MS && !processor.sentenceEndTriggered) {
              console.log(`🟢 [${speaker}] Speech ended (duration: ${speechDuration}ms)`);

              processor.sentenceEndTriggered = true;
              processor.isSpeaking = false;

              if (speechDuration >= MIN_SPEECH_DURATION_MS) {
                const finalBuffers = [...processor.sentenceBuffer];
                const partialId = processor.partialMessageId;
                processor.sentenceBuffer = [];
                processor.lastPartialTime = 0;
                processor.partialMessageId = null;
                processFinalTranscript(finalBuffers, speaker, partialId, setStatus);
              } else {
                console.log(`⚠️ [${speaker}] Speech too short, discarding`);
                if (processor.partialMessageId !== null) {
                  setMessages((prev) => prev.filter((msg) => msg.id !== processor.partialMessageId));
                  processor.partialMessageId = null;
                }
                processor.sentenceBuffer = [];
                processor.lastPartialTime = 0;
              }
            }
          }
        }
      };

      processor.vadInterval = window.setInterval(checkAudioLevel, 50);

      return processor;
    } catch (error) {
      console.error(`Failed to create mic processor for ${speaker}:`, error);
      toast.error(`無法啟動${speaker === "nurse" ? "台灣人" : "外國人"}麥克風`);
      return null;
    }
  }, [RMS_THRESHOLD, MIN_SPEECH_DURATION_MS, SILENCE_DURATION_MS, PARTIAL_CHUNK_INTERVAL_MS, processPartialChunk, processFinalTranscript]);

  // 停止單一麥克風處理器
  const stopMicProcessor = useCallback((processor: MicProcessor | null) => {
    if (!processor) return;

    if (processor.vadInterval) {
      clearInterval(processor.vadInterval);
    }
    if (processor.workletNode) {
      processor.workletNode.disconnect();
    }
    if (processor.audioContext) {
      processor.audioContext.close();
    }
    if (processor.stream) {
      processor.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  // 開始錄音
  const startRecording = async () => {
    if (!nurseMicId || !patientMicId) {
      toast.error("請先選擇兩個麥克風");
      return;
    }

    if (nurseMicId === patientMicId) {
      toast.error("請選擇不同的麥克風");
      return;
    }

    // 啟動台灣人麥克風
    const nurseProcessor = await createMicProcessor(nurseMicId, "nurse", setNurseStatus);
    if (!nurseProcessor) return;
    nurseProcessorRef.current = nurseProcessor;

    // 啟動外國人麥克風
    const patientProcessor = await createMicProcessor(patientMicId, "patient", setPatientStatus);
    if (!patientProcessor) {
      stopMicProcessor(nurseProcessor);
      return;
    }
    patientProcessorRef.current = patientProcessor;

    setIsRecording(true);
    setNurseStatus("listening");
    setPatientStatus("listening");
    toast.success("雙麥克風已啟動");
  };

  // 停止錄音
  const stopRecording = () => {
    stopMicProcessor(nurseProcessorRef.current);
    stopMicProcessor(patientProcessorRef.current);
    nurseProcessorRef.current = null;
    patientProcessorRef.current = null;

    // 清除 partial 訊息
    setMessages((prev) => prev.filter((msg) => msg.status !== "partial"));

    setIsRecording(false);
    setNurseStatus("idle");
    setPatientStatus("idle");
    toast.info("已停止錄音");
  };

  // 清除對話
  const clearMessages = () => {
    setMessages([]);
    messageIdCounterRef.current = 0;
  };

  // 取得目標語言資訊
  const getTargetLanguageInfo = () => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage) || SUPPORTED_LANGUAGES[0];
  };

  // 狀態指示器元件
  const StatusIndicator = ({ status, label }: { status: string; label: string }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
      status === "idle" ? "bg-gray-700" :
      status === "listening" ? "bg-green-700" :
      status === "recognizing" ? "bg-yellow-700" :
      "bg-blue-700"
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        status === "idle" ? "bg-gray-400" :
        status === "listening" ? "bg-green-400 animate-pulse" :
        status === "recognizing" ? "bg-yellow-400 animate-pulse" :
        "bg-blue-400 animate-pulse"
      }`} />
      <span>{label}</span>
    </div>
  );

  // 過濾訊息
  const nurseMessages = messages.filter((m) => m.speaker === "nurse");
  const patientMessages = messages.filter((m) => m.speaker === "patient");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-gray-700/50 p-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-xl md:text-2xl font-bold">🎤🎤 雙麥克風翻譯</h1>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* 語言選擇 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">外語：</span>
                <Select
                  value={targetLanguage}
                  onValueChange={setTargetLanguage}
                  disabled={isRecording}
                >
                  <SelectTrigger className="w-[130px] bg-gray-800 border-gray-600">
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

          {/* 麥克風選擇 */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 whitespace-nowrap">🇹🇼 台灣人麥克風：</span>
              <Select
                value={nurseMicId}
                onValueChange={setNurseMicId}
                disabled={isRecording}
              >
                <SelectTrigger className="flex-1 bg-gray-800 border-gray-600">
                  <SelectValue placeholder="選擇麥克風" />
                </SelectTrigger>
                <SelectContent>
                  {availableMics.map((mic) => (
                    <SelectItem key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 whitespace-nowrap">{getTargetLanguageInfo().flag} 外國人麥克風：</span>
              <Select
                value={patientMicId}
                onValueChange={setPatientMicId}
                disabled={isRecording}
              >
                <SelectTrigger className="flex-1 bg-gray-800 border-gray-600">
                  <SelectValue placeholder="選擇麥克風" />
                </SelectTrigger>
                <SelectContent>
                  {availableMics.map((mic) => (
                    <SelectItem key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
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
        <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
          <StatusIndicator 
            status={nurseStatus} 
            label={`🇹🇼 ${nurseStatus === "idle" ? "待機" : nurseStatus === "listening" ? "聆聽中" : nurseStatus === "recognizing" ? "識別中" : "翻譯中"}`} 
          />
          <StatusIndicator 
            status={patientStatus} 
            label={`${getTargetLanguageInfo().flag} ${patientStatus === "idle" ? "待機" : patientStatus === "listening" ? "聆聽中" : patientStatus === "recognizing" ? "識別中" : "翻譯中"}`} 
          />
        </div>

        {/* 雙欄對話框 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 台灣人對話框 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">🇹🇼 台灣人（中文）</h2>
              {nurseMessages.length > 0 && (
                <span className="text-xs text-gray-500">{nurseMessages.length} 則</span>
              )}
            </div>

            <div className="h-[300px] md:h-[400px] overflow-y-auto space-y-3 pr-2">
              {nurseMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  說中文 → 翻譯成{getTargetLanguageInfo().name}
                </div>
              ) : (
                nurseMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl ${
                      msg.status === "partial"
                        ? "bg-yellow-900/30 border border-yellow-700/50"
                        : "bg-blue-900/30 border border-blue-700/50"
                    }`}
                  >
                    {msg.status === "partial" ? (
                      <div className="text-gray-300 italic">
                        {msg.originalText || "偵測中..."}
                      </div>
                    ) : (
                      <>
                        <div className="text-white mb-2">{msg.originalText}</div>
                        <div className="border-t border-gray-600/50 pt-2">
                          <div className="text-cyan-400">{msg.translatedText}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 外國人對話框 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{getTargetLanguageInfo().flag} 外國人（{getTargetLanguageInfo().name}）</h2>
              {patientMessages.length > 0 && (
                <span className="text-xs text-gray-500">{patientMessages.length} 則</span>
              )}
            </div>

            <div className="h-[300px] md:h-[400px] overflow-y-auto space-y-3 pr-2">
              {patientMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  說{getTargetLanguageInfo().name} → 翻譯成中文
                </div>
              ) : (
                patientMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl ${
                      msg.status === "partial"
                        ? "bg-yellow-900/30 border border-yellow-700/50"
                        : "bg-green-900/30 border border-green-700/50"
                    }`}
                  >
                    {msg.status === "partial" ? (
                      <div className="text-gray-300 italic">
                        {msg.originalText || "偵測中..."}
                      </div>
                    ) : (
                      <>
                        <div className="text-white mb-2">{msg.originalText}</div>
                        <div className="border-t border-gray-600/50 pt-2">
                          <div className="text-cyan-400">{msg.translatedText}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 控制按鈕 */}
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!nurseMicId || !patientMicId}
            className={`px-8 py-6 text-lg rounded-full ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isRecording ? "⏹️ 結束對話" : "🎤 開始對話"}
          </Button>

          {messages.length > 0 && (
            <Button
              size="lg"
              variant="outline"
              onClick={clearMessages}
              className="px-6 py-6 text-lg rounded-full"
            >
              🗑️ 清除
            </Button>
          )}
        </div>

        {/* 提示 */}
        {!isRecording && availableMics.length < 2 && (
          <div className="mt-6 text-center text-yellow-400 text-sm">
            ⚠️ 偵測到 {availableMics.length} 個麥克風，建議連接 2 個麥克風以使用雙麥克風功能
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm border-t border-gray-700/50 p-2">
        <div className="container mx-auto text-center text-xs text-gray-500">
          台灣人說中文 → {getTargetLanguageInfo().name} ｜ 外國人說{getTargetLanguageInfo().name} → 中文
        </div>
      </footer>
    </div>
  );
}
