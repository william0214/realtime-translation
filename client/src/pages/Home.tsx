import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, History as HistoryIcon, Mic, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { callGoTranslation } from "@/services/goBackend";
import { HybridASRClient } from "@/services/hybridASRClient";

type ConversationMessage = {
  id: number;
  speaker: "nurse" | "patient";
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  timestamp: Date;
  status: "partial" | "final" | "translated";
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
const RMS_THRESHOLD = 0.055; // Voice activity detection threshold (-55dB)
const SILENCE_DURATION_MS = 650; // Silence duration to end speech segment (optimized for accuracy)
const MIN_SPEECH_DURATION_MS = 250; // Minimum speech duration to start partial (VAD minActive)
const PARTIAL_CHUNK_INTERVAL_MS = 320; // Partial chunk interval (optimized 300-350ms)
const PARTIAL_CHUNK_MIN_DURATION_MS = 250; // Minimum partial chunk duration to avoid fragmentation
const MAX_SEGMENT_DURATION = 0.5; // Maximum segment duration for chunking
const SAMPLE_RATE = 48000; // 48kHz

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("vi");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  
  // Backend selection: "nodejs" | "go" | "hybrid"
  const [backend, setBackend] = useState<"nodejs" | "go" | "hybrid">(() => {
    const saved = localStorage.getItem("translation-backend");
    return (saved === "go" || saved === "nodejs" || saved === "hybrid") ? saved : "nodejs";
  });
  
  // Hybrid ASR client
  const hybridClientRef = useRef<HybridASRClient | null>(null);
  const [isHybridConnected, setIsHybridConnected] = useState(false);
  const [partialSubtitle, setPartialSubtitle] = useState<string>("");
  const [titleClickCount, setTitleClickCount] = useState(0);
  const titleClickTimeoutRef = useRef<number | null>(null);
  
  // Partial transcript state
  const partialMessageIdRef = useRef<number | null>(null); // Track current partial message ID
  const lastPartialTimeRef = useRef<number>(0); // Track last partial push time
  const partialIntervalRef = useRef<number | null>(null); // Interval for partial pushes

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
  const speechStartTimeRef = useRef<number>(0); // Track when speech actually started
  const isSpeakingRef = useRef<boolean>(false);
  const vadIntervalRef = useRef<number | null>(null);
  const sentenceBufferRef = useRef<Float32Array[]>([]);
  const processSentenceForTranslationRef = useRef<((pcmBuffer: Float32Array[]) => Promise<void>) | null>(null);
  const sentenceEndTriggeredRef = useRef<boolean>(false); // Prevent multiple sentence end triggers

  // tRPC mutations (for Node.js backend)
  const translateMutation = trpc.translation.autoTranslate.useMutation();
  const createConversationMutation = trpc.conversation.create.useMutation();
  const saveTranslationMutation = trpc.conversation.saveTranslation.useMutation();
  const endConversationMutation = trpc.conversation.end.useMutation();

  // Handle title click for backend switching (3 clicks within 2 seconds)
  const handleTitleClick = () => {
    const newCount = titleClickCount + 1;
    setTitleClickCount(newCount);

    if (titleClickTimeoutRef.current) {
      clearTimeout(titleClickTimeoutRef.current);
    }

    if (newCount >= 3) {
      // Toggle backend: nodejs → go → hybrid → nodejs
      let newBackend: "nodejs" | "go" | "hybrid";
      if (backend === "nodejs") {
        newBackend = "go";
      } else if (backend === "go") {
        newBackend = "hybrid";
      } else {
        newBackend = "nodejs";
      }
      setBackend(newBackend);
      localStorage.setItem("translation-backend", newBackend);
      const backendName = newBackend === "nodejs" ? "Node.js" : newBackend === "go" ? "Go" : "Hybrid ASR";
      toast.success(`已切換到 ${backendName} 後端`);
      setTitleClickCount(0);
    } else {
      titleClickTimeoutRef.current = window.setTimeout(() => {
        setTitleClickCount(0);
      }, 2000);
    }
  };

  // Show backend indicator
  useEffect(() => {
    console.log(`[Backend] Current backend: ${backend}`);
  }, [backend]);

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

  // Process partial chunk for immediate subtitle (250-350ms, update same message, no translation)
  const processPartialChunk = useCallback(async (pcmBuffer: Float32Array[]) => {
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
            // Call backend based on selection
            const result = backend === "nodejs"
              ? await translateMutation.mutateAsync({
                  audioBase64: base64Audio,
                  filename: `subtitle-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage,
                })
              : await callGoTranslation({
                  audioBase64: base64Audio,
                  filename: `subtitle-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage,
                });

            if (result.success && result.sourceText) {
              // Update partial message (same message, no translation)
              if (partialMessageIdRef.current === null) {
                // Create new partial message
                const newPartialMessage: ConversationMessage = {
                  id: messageIdRef.current++,
                  speaker: "nurse", // Assume nurse for now (can be enhanced later)
                  originalText: result.sourceText,
                  translatedText: "",
                  detectedLanguage: "zh",
                  timestamp: new Date(),
                  status: "partial",
                };
                partialMessageIdRef.current = newPartialMessage.id;
                setConversations((prev) => [...prev, newPartialMessage]);
                console.log(`[Partial] Created partial message #${newPartialMessage.id}: "${result.sourceText}"`);
              } else {
                // Update existing partial message
                setConversations((prev) =>
                  prev.map((msg) =>
                    msg.id === partialMessageIdRef.current
                      ? { ...msg, originalText: result.sourceText || "", timestamp: new Date() }
                      : msg
                  )
                );
                console.log(`[Partial] Updated partial message #${partialMessageIdRef.current}: "${result.sourceText}"`);
              }
              setCurrentSubtitle(result.sourceText);
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

  // Process final transcript (覆蓋 partial) + 非阻塞翻譯
  const processFinalTranscript = useCallback(async (pcmBuffer: Float32Array[]) => {
    if (pcmBuffer.length === 0) return;

    // Calculate audio duration
    const totalSamples = pcmBuffer.reduce((acc, buf) => acc + buf.length, 0);
    const audioDuration = totalSamples / SAMPLE_RATE;
    
    // Skip if audio is too short (Whisper requires minimum 0.1 seconds)
    if (audioDuration < 0.1) {
      console.log(`[Translation] Audio too short (${audioDuration.toFixed(3)}s < 0.1s), skipping`);
      setProcessingStatus("listening");
      return;
    }

    console.log(`[Translation] Processing sentence with ${pcmBuffer.length} PCM buffers (duration: ${audioDuration.toFixed(2)}s)`);
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
            // Call backend based on selection
            const result = backend === "nodejs"
              ? await translateMutation.mutateAsync({
                  audioBase64: base64Audio,
                  filename: `translation-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage,
                })
              : await callGoTranslation({
                  audioBase64: base64Audio,
                  filename: `translation-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage,
                });

            if (result.success && result.sourceText) {
              const speaker = result.direction === "nurse_to_patient" ? "nurse" : "patient";
              
              // Step 1: Update partial message to final (覆蓋 partial)
              if (partialMessageIdRef.current !== null) {
                setConversations((prev) =>
                  prev.map((msg) =>
                    msg.id === partialMessageIdRef.current
                      ? { ...msg, originalText: result.sourceText || "", status: "final" as const, timestamp: new Date() }
                      : msg
                  )
                );
                console.log(`[Final] Updated partial #${partialMessageIdRef.current} to final: "${result.sourceText}"`);
                partialMessageIdRef.current = null; // Reset partial message ID
              } else {
                // No partial message, create new final message
                const finalMessage: ConversationMessage = {
                  id: messageIdRef.current++,
                  speaker,
                  originalText: result.sourceText,
                  translatedText: "",
                  detectedLanguage: result.sourceLang || "unknown",
                  timestamp: new Date(),
                  status: "final",
                };
                setConversations((prev) => [...prev, finalMessage]);
                console.log(`[Final] Created final message #${finalMessage.id}: "${result.sourceText}"`);
              }
              
              // Step 2: 非阻塞翻譯（async）
              if (result.translatedText) {
                // Translation already done, add translated message immediately
                const translatedMessage: ConversationMessage = {
                  id: messageIdRef.current++,
                  speaker,
                  originalText: result.sourceText,
                  translatedText: result.translatedText,
                  detectedLanguage: result.sourceLang || "unknown",
                  timestamp: new Date(),
                  status: "translated",
                };
                setConversations((prev) => [...prev, translatedMessage]);
                console.log(`[Translated] Added translated message #${translatedMessage.id}`);
                
                // Save translation to database
                if (currentConversationId) {
                  saveTranslationMutation.mutate({
                    conversationId: currentConversationId,
                    direction: result.direction!,
                    sourceLang: result.sourceLang || "unknown",
                    targetLang: result.targetLang || targetLanguage,
                    sourceText: result.sourceText,
                    translatedText: result.translatedText,
                  });
                  console.log(`[Conversation] Saved translation to conversation ID: ${currentConversationId}`);
                }
              }
              
              setCurrentSubtitle(""); // Clear subtitle after final
              setProcessingStatus("listening");
            } else {
            const errorMsg = result.error || "未知錯誤";
            console.error("[Translation] Translation failed:", errorMsg);
            if (!errorMsg.includes("No speech detected")) {
              toast.error(`❌ 翻譯失敗: ${errorMsg}`);
            }
            }
          } catch (error: any) {
          console.error("[Translation] Error:", error);
          toast.error(`❌ 處理語音時發生錯誤: ${error.message || '未知錯誤'}`);
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
      toast.error(`❌ 語音處理失敗: ${error.message || '未知錯誤'}`);
      setProcessingStatus("listening");
    }
  }, [targetLanguage, translateMutation]);

  // Update ref for processFinalTranscript
  useEffect(() => {
    processSentenceForTranslationRef.current = processFinalTranscript;
  }, [processFinalTranscript]);

  // Start VAD monitoring
  const startVADMonitoring = useCallback(() => {
    if (vadIntervalRef.current !== null) return;

    console.log("[VAD] Started VAD monitoring");
    setProcessingStatus("listening");
    chunkStartTimeRef.current = Date.now();

    vadIntervalRef.current = window.setInterval(() => {
      const isSpeaking = checkAudioLevel();
      const now = Date.now();

      // Track 1: Partial chunks (320ms) for immediate subtitle (only when speaking)
      const partialDuration = now - lastPartialTimeRef.current;
      if (partialDuration >= PARTIAL_CHUNK_INTERVAL_MS && isSpeakingRef.current) {
        // Check minimum chunk duration to avoid fragmentation
        const speechDuration = now - speechStartTimeRef.current;
        if (speechDuration >= PARTIAL_CHUNK_MIN_DURATION_MS && sentenceBufferRef.current.length > 0) {
          // Process partial chunk for subtitle (use sentenceBuffer which accumulates during speech)
          processPartialChunk([...sentenceBufferRef.current]);
          // Don't clear sentenceBuffer - it will be used for final transcript
        }
        lastPartialTimeRef.current = now;
      }
      
      // Clear currentChunkBuffer periodically to prevent memory leak
      const chunkDuration = (now - chunkStartTimeRef.current) / 1000;
      if (chunkDuration >= MAX_SEGMENT_DURATION) {
        currentChunkBufferRef.current = [];
        chunkStartTimeRef.current = now;
      }

      // Track 2: VAD-based segments for translation
      if (isSpeaking) {
        lastSpeechTimeRef.current = now;
        if (!isSpeakingRef.current) {
          // Speech segment start
          speechStartTimeRef.current = now;
          isSpeakingRef.current = true;
          sentenceEndTriggeredRef.current = false; // Reset flag when speech starts
          setProcessingStatus("vad-detected");
          console.log(`🔵 Speech started`);
        }
      } else {
        if (isSpeakingRef.current) {
          const silenceDuration = now - lastSpeechTimeRef.current;
          if (silenceDuration >= SILENCE_DURATION_MS && !sentenceEndTriggeredRef.current) {
            // Check minimum speech duration to filter short noise
            const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current;
            
            if (speechDuration < MIN_SPEECH_DURATION_MS) {
              // Too short, likely noise - discard
              console.log(`⚠️ Speech too short (${speechDuration}ms), discarding as noise`);
              isSpeakingRef.current = false;
              sentenceBufferRef.current = [];
              sentenceEndTriggeredRef.current = true; // Mark as triggered to prevent re-entry
              setProcessingStatus("listening");
            } else if (!sentenceEndTriggeredRef.current) {
              // Speech segment end (valid speech) - only trigger once
              sentenceEndTriggeredRef.current = true; // Set flag immediately to prevent multiple triggers
              isSpeakingRef.current = false;
              setProcessingStatus("listening");
              console.log(`🟢 Speech ended (duration: ${speechDuration}ms, silence: ${silenceDuration}ms), processing final transcript ONCE...`);

              // Process final transcript (only once)
              if (sentenceBufferRef.current.length > 0) {
                processFinalTranscript([...sentenceBufferRef.current]);
                sentenceBufferRef.current = [];
              }
              
              // Reset partial state
              lastPartialTimeRef.current = 0;
            }
          }
        }
      }
    }, 100);
  }, [checkAudioLevel, processPartialChunk, processFinalTranscript]);

  // Stop VAD monitoring
  const stopVADMonitoring = useCallback(() => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
      console.log("[VAD] Stopped VAD monitoring");
    }
  }, []);

  // Start Hybrid ASR recording
  const startHybridRecording = useCallback(async () => {
    try {
      // Create Hybrid ASR client
      // Use environment variable or default to localhost for development
      const wsUrl = import.meta.env.VITE_HYBRID_ASR_WS_URL || "ws://localhost:8080/ws/hybrid-asr";
      console.log('[Hybrid] Using WebSocket URL:', wsUrl);
      
      const client = new HybridASRClient(
        wsUrl,
        "default",
        "hybrid"
      );

      // Set callbacks
      client.onPartialTranscript = (data) => {
        console.log(`[Hybrid Partial] ${data.transcript} (${data.latency_ms}ms)`);
        setPartialSubtitle(data.transcript);
        setCurrentSubtitle(data.transcript);
      };

      client.onFinalTranscript = (data) => {
        console.log(`[Hybrid Final] ${data.transcript} → ${data.translation} (${data.total_latency_ms}ms)`);
        
        // Add to conversation
        const newMessage: ConversationMessage = {
          id: ++messageIdRef.current,
          speaker: data.detected_lang === "zh" || data.detected_lang === "zh-TW" ? "nurse" : "patient",
          originalText: data.transcript,
          translatedText: data.translation,
          detectedLanguage: data.detected_lang,
          timestamp: new Date(),
          status: "translated",
        };
        
        setConversations((prev) => [...prev, newMessage]);
        setPartialSubtitle("");
        setCurrentSubtitle("");
        
        // Play TTS audio
        if (data.tts_audio_data) {
          client.playAudio(data.tts_audio_data);
        }
      };

      client.onError = (error) => {
        console.error(`[Hybrid Error] ${error}`);
        toast.error(`❌ Hybrid ASR 錯誤: ${error}`);
      };

      client.onConnected = () => {
        console.log("[Hybrid] Connected to WebSocket");
        setIsHybridConnected(true);
        toast.success("已連接到 Hybrid ASR 伺服器");
      };

      client.onDisconnected = () => {
        console.log("[Hybrid] Disconnected from WebSocket");
        setIsHybridConnected(false);
      };

      // Connect to WebSocket
      await client.connect();
      hybridClientRef.current = client;

      // Start audio capture
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
      audioContextRef.current = audioContext;

      // Setup AudioWorklet
      await audioContext.audioWorklet.addModule("/audio-processor.js");
      const audioWorkletNode = new AudioWorkletNode(audioContext, "audio-capture-processor");

      audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === "audioData" && client.isConnected()) {
          // Convert Float32Array to ArrayBuffer and send to WebSocket
          const pcmData = event.data.data as Float32Array;
          const buffer = pcmData.buffer.slice(0) as ArrayBuffer;
          client.sendAudioChunk(buffer, SAMPLE_RATE, "pcm");
        }
      };

      source.connect(audioWorkletNode);
      audioWorkletNode.connect(audioContext.destination);
      audioWorkletNodeRef.current = audioWorkletNode;

      setIsRecording(true);
      setProcessingStatus("listening");
      toast.success("開始 Hybrid ASR 錄音");
    } catch (error: any) {
      console.error("[Hybrid] Error starting recording:", error);
      toast.error(`❌ 無法啟動 Hybrid ASR: ${error.message || '連線失敗'}`);
    }
  }, [targetLanguage]);

  // Stop Hybrid ASR recording
  const stopHybridRecording = useCallback(() => {
    console.log("[Hybrid] Stopping recording");

    if (hybridClientRef.current) {
      hybridClientRef.current.stop();
      hybridClientRef.current.disconnect();
      hybridClientRef.current = null;
    }

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

    setIsHybridConnected(false);
    setPartialSubtitle("");
    setCurrentSubtitle("");
    setProcessingStatus("idle");
    setIsRecording(false);
    toast.success("停止 Hybrid ASR 錄音");
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // If using Hybrid mode, connect to WebSocket
      if (backend === "hybrid") {
        await startHybridRecording();
        return;
      }

      // Create a new conversation session (for Node.js/Go backends)
      const conversationResult = await createConversationMutation.mutateAsync({
        targetLanguage,
        title: `對話 - ${new Date().toLocaleString("zh-TW")}`,
      });

      if (conversationResult.success && conversationResult.conversationId) {
        setCurrentConversationId(conversationResult.conversationId);
        console.log(`[Conversation] Created conversation ID: ${conversationResult.conversationId}`);
      } else {
        toast.error(`❌ 建立對話會話失敗: ${conversationResult.error || '未知錯誤'}`);
        return;
      }

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
      console.error("[Recording] Error starting recording:", error);
      const errorMsg = error.name === 'NotAllowedError' 
        ? '麥克風權限被拒絕，請允許使用麥克風'
        : error.name === 'NotFoundError'
        ? '找不到麥克風裝置'
        : `${error.message || '未知錯誤'}`;
      toast.error(`❌ 無法啟動麥克風: ${errorMsg}`);
    }
  }, [createConversationMutation, targetLanguage, startVADMonitoring]);

  // Stop recording
  const stopRecording = useCallback(() => {
    console.log("[stopRecording] Stopping recording");
    
    // If using Hybrid mode, stop Hybrid recording
    if (backend === "hybrid") {
      stopHybridRecording();
      return;
    }
    
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

    // End conversation
    if (currentConversationId) {
      endConversationMutation.mutate({
        conversationId: currentConversationId,
      });
      console.log(`[Conversation] Ended conversation ID: ${currentConversationId}`);
      setCurrentConversationId(null);
    }

    toast.success("停止錄音");
  }, [stopVADMonitoring, currentConversationId, endConversationMutation]);

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
      toast.error("⚠️ 沒有對話記錄可匯出");
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

  // Get status display with color and animation
  const getStatusDisplay = () => {
    switch (processingStatus) {
      case "listening":
        return { text: "等待語音", color: "text-blue-400", icon: "🔵" };
      case "vad-detected":
        return { text: "偵測到語音", color: "text-green-400 animate-pulse", icon: "🟢" };
      case "recognizing":
        return { text: "正在辨識", color: "text-yellow-400 animate-pulse", icon: "🟡" };
      case "translating":
        return { text: "正在翻譯", color: "text-purple-400 animate-pulse", icon: "🟣" };
      case "speaking":
        return { text: "播放中", color: "text-pink-400 animate-pulse", icon: "🔊" };
      default:
        return { text: "閒置", color: "text-gray-500", icon: "⚪" };
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 p-3 md:p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 
            className="text-lg md:text-2xl font-bold cursor-pointer select-none relative"
            onClick={handleTitleClick}
            title="連點三次切換後端"
          >
            即時雙向翻譯系統
            <span className="ml-2 text-xs opacity-50">
              {backend === "nodejs" ? "(Node.js)" : backend === "go" ? "(Go)" : "(Hybrid)"}
            </span>
            {backend === "hybrid" && isHybridConnected && (
              <span className="ml-2 text-xs text-green-400 animate-pulse">
                • 已連接
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isRecording}>
              <SelectTrigger className="w-[120px] md:w-[180px] bg-gray-900 border-gray-700 text-sm md:text-base">
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
            <Link href="/history">
              <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                <HistoryIcon className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="icon" onClick={exportConversations} disabled={conversations.length === 0} className="h-8 w-8 md:h-10 md:w-10">
              <Download className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={clearConversations} disabled={conversations.length === 0} className="h-8 w-8 md:h-10 md:w-10">
              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-gray-900 p-2 md:p-3 text-center text-xs md:text-sm border-b border-gray-800">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
          <div className={`flex items-center gap-2 font-medium ${getStatusDisplay().color}`}>
            <span className="text-lg md:text-xl">{getStatusDisplay().icon}</span>
            <span>{getStatusDisplay().text}</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">音量:</span>
              <div className="w-24 md:w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${audioLevel > 1 ? "bg-green-500" : "bg-gray-600"}`}
                  style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
          {currentSubtitle && (
            <div className="flex items-center gap-2 max-w-full">
              <span className="text-yellow-400 flex-shrink-0">即時字幕:</span>
              <span className="text-white truncate">{currentSubtitle}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="text-center mb-4 md:mb-6 text-gray-400 text-sm md:text-base">
          點擊「開始對話」後，系統將持續偵測語音並即時翻譯
        </div>

        {/* Desktop: Side by side (left-right) */}
        {/* Mobile: Stacked (外國人 top, 台灣人 bottom, both facing outward) */}
        <div className="flex flex-col-reverse md:grid md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
          {/* Nurse (Chinese) - Bottom on mobile (rotated 180deg to face up), Left on desktop */}
          <div className="bg-gray-900 rounded-lg p-3 md:p-4 md:rotate-0 rotate-180">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-center">台灣人 (中文)</h2>
            <div ref={nurseScrollRef} className="h-[250px] md:h-[400px] overflow-y-auto space-y-2 md:space-y-3">
              {/* Partial transcript (即時字幕) */}
              {conversations
                .filter((msg) => msg.speaker === "nurse" && msg.status === "partial")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800/50 p-2 md:p-3 rounded border border-yellow-500/30">
                    <div className="text-xs md:text-sm text-yellow-400 mb-1 flex items-center gap-2">
                      <span className="animate-pulse">●</span>
                      即時字幕（處理中...）
                    </div>
                    <div className="font-medium mb-1 text-sm md:text-base text-gray-300 italic">
                      {msg.originalText}
                    </div>
                    <div className="text-gray-500 text-xs md:text-sm">等待完整識別...</div>
                  </div>
                ))}
              
              {/* Final transcripts (完整句子) */}
              {conversations
                .filter((msg) => msg.speaker === "nurse" && msg.status === "final")
                .map((msg) => (
                  <div key={msg.id} className="bg-blue-900/30 p-2 md:p-3 rounded border border-blue-500/30">
                    <div className="text-xs md:text-sm text-gray-400 mb-1">{msg.timestamp.toLocaleTimeString("zh-TW")}</div>
                    <div className="font-medium text-sm md:text-base text-blue-100">{msg.originalText}</div>
                  </div>
                ))}
              
              {/* Translated messages (翻譯結果) */}
              {conversations
                .filter((msg) => msg.speaker === "nurse" && msg.status === "translated")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-2 md:p-3 rounded">
                    <div className="text-xs md:text-sm text-gray-400 mb-1">{msg.timestamp.toLocaleTimeString("zh-TW")}</div>
                    <div className="font-medium text-sm md:text-base mb-1">{msg.originalText}</div>
                    <div className="text-xs md:text-sm text-gray-400">→ {msg.translatedText}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Patient (Foreign Language) - Top on mobile (normal, facing down), Right on desktop */}
          <div className="bg-gray-900 rounded-lg p-3 md:p-4">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-center">外國人 (外語)</h2>
            <div ref={patientScrollRef} className="h-[250px] md:h-[400px] overflow-y-auto space-y-2 md:space-y-3">
              {/* Partial transcript (即時字幕) */}
              {conversations
                .filter((msg) => msg.speaker === "patient" && msg.status === "partial")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800/50 p-2 md:p-3 rounded border border-yellow-500/30">
                    <div className="text-xs md:text-sm text-yellow-400 mb-1 flex items-center gap-2">
                      <span className="animate-pulse">●</span>
                      即時字幕（處理中...）
                    </div>
                    <div className="font-medium mb-1 text-sm md:text-base text-gray-300 italic">
                      {msg.originalText}
                    </div>
                    <div className="text-gray-500 text-xs md:text-sm">等待完整識別...</div>
                  </div>
                ))}
              
              {/* Final transcripts (完整句子) */}
              {conversations
                .filter((msg) => msg.speaker === "patient" && msg.status === "final")
                .map((msg) => (
                  <div key={msg.id} className="bg-blue-900/30 p-2 md:p-3 rounded border border-blue-500/30">
                    <div className="text-xs md:text-sm text-gray-400 mb-1">{msg.timestamp.toLocaleTimeString("zh-TW")}</div>
                    <div className="font-medium text-sm md:text-base text-blue-100">{msg.originalText}</div>
                  </div>
                ))}
              
              {/* Translated messages (翻譯結果) */}
              {conversations
                .filter((msg) => msg.speaker === "patient" && msg.status === "translated")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-2 md:p-3 rounded">
                    <div className="text-xs md:text-sm text-gray-400 mb-1">{msg.timestamp.toLocaleTimeString("zh-TW")}</div>
                    <div className="font-medium text-sm md:text-base">{msg.translatedText}</div>
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
            className={`px-6 md:px-8 py-4 md:py-6 text-base md:text-lg ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Mic className="mr-2 h-4 md:h-5 w-4 md:w-5" />
            {isRecording ? "結束對話" : "開始對話"}
          </Button>
        </div>
      </main>
    </div>
  );
}
