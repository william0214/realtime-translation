import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, History as HistoryIcon, Mic, Trash2, FileText, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { callGoTranslation } from "@/services/goBackend";
import { HybridASRClient } from "@/services/hybridASRClient";
import { VAD_CONFIG, ASR_CONFIG, AUDIO_CONFIG, ASR_MODE_CONFIG, WHISPER_CONFIG, type ASRMode, getASRModeConfig } from "@shared/config";

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
  { value: "auto", label: "🤖 自動判斷" },
  { value: "vi", label: "越南語" },
  { value: "id", label: "印尼語" },
  { value: "fil", label: "菲律賓語" },
  { value: "en", label: "英文" },
  { value: "it", label: "義大利語" },
  { value: "ja", label: "日文" },
  { value: "ko", label: "韓文" },
  { value: "th", label: "泰文" },
];

const MAX_SEGMENT_DURATION = 0.5; // Maximum segment duration for chunking
const SAMPLE_RATE = 48000; // 48kHz

/**
 * Detect Whisper hallucination (repeated strings)
 * Common patterns:
 * - "Ch-Ch-Ch-Ch-Ch-Ch..." (repeated syllables)
 * - "謝謝,謝謝,謝謝,謝謝..." (repeated words)
 * - "Thank you, thank you, thank you..." (repeated phrases)
 */
function detectWhisperHallucination(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  // Pattern 1: Check for repeated short patterns (e.g., "Ch-Ch-Ch" or "謝謝,謝謝")
  const shortPatternRegex = /(.{1,5})\1{5,}/; // Same 1-5 chars repeated 5+ times
  if (shortPatternRegex.test(text)) {
    return true;
  }
  
  // Pattern 2: Check for repeated words/phrases separated by comma or space
  const words = text.split(/[,，\s]+/).filter(w => w.length > 0);
  if (words.length >= 5) {
    const uniqueWords = new Set(words);
    // If 80%+ of words are the same, it's likely hallucination
    if (uniqueWords.size <= 2 && words.length >= 8) {
      return true;
    }
  }
  
  // Pattern 3: Known hallucination phrases (YouTube/Podcast artifacts)
  const knownHallucinations = [
    "請不吝點贊訂閱",
    "本期視頻拍到這裡",
    "Amara 字幕",
    "lalaschool",
    "請訂閱我的頻道",
    "Thank you for watching",
    "Don't forget to subscribe",
  ];
  for (const phrase of knownHallucinations) {
    if (text.includes(phrase)) {
      return true;
    }
  }
  
  return false;
}

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
  
  // ASR mode selection: "normal" | "precise"
  const [asrMode, setAsrMode] = useState<ASRMode>(() => {
    const saved = localStorage.getItem("asr-mode");
    return (saved === "normal" || saved === "precise") ? saved : "normal";
  });
  
  // Save ASR mode to localStorage when changed
  useEffect(() => {
    localStorage.setItem("asr-mode", asrMode);
  }, [asrMode]);
  
  // ASR model selection: "gpt-4o-mini-transcribe" | "gpt-4o-transcribe"
  const [asrModel, setAsrModel] = useState<string>(() => {
    const saved = localStorage.getItem("asr-model");
    return saved || WHISPER_CONFIG.MODEL;
  });
  
  // Save ASR model to localStorage when changed
  useEffect(() => {
    localStorage.setItem("asr-model", asrModel);
  }, [asrModel]);
  
  // Hybrid ASR client
  const hybridClientRef = useRef<HybridASRClient | null>(null);
  const [isHybridConnected, setIsHybridConnected] = useState(false);
  const [partialSubtitle, setPartialSubtitle] = useState<string>("");
  const [titleClickCount, setTitleClickCount] = useState(0);
  const titleClickTimeoutRef = useRef<number | null>(null);
  
  // Mirror display for transparent screen
  const [mirrorForeignView, setMirrorForeignView] = useState<boolean>(() => {
    const saved = localStorage.getItem("mirror-foreign-view");
    return saved === "true";
  });
  
  // 🎙️ Dual Microphone Mode (simplified: manual speaker switch)
  const [dualMicMode, setDualMicMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("dual-mic-mode");
    return saved === "true";
  });
  // Current speaker in dual mic mode: "nurse" (Taiwan) or "patient" (Foreign)
  const [currentSpeaker, setCurrentSpeaker] = useState<"nurse" | "patient">("nurse");
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [nurseMicId, setNurseMicId] = useState<string>(() => {
    return localStorage.getItem("nurse-mic-id") || "";
  });
  const [patientMicId, setPatientMicId] = useState<string>(() => {
    return localStorage.getItem("patient-mic-id") || "";
  });
  
  // Dual mic streams and contexts
  const nurseStreamRef = useRef<MediaStream | null>(null);
  const patientStreamRef = useRef<MediaStream | null>(null);
  const nurseAudioContextRef = useRef<AudioContext | null>(null);
  const patientAudioContextRef = useRef<AudioContext | null>(null);
  const nurseAnalyserRef = useRef<AnalyserNode | null>(null);
  const patientAnalyserRef = useRef<AnalyserNode | null>(null);
  const nurseWorkletRef = useRef<AudioWorkletNode | null>(null);
  const patientWorkletRef = useRef<AudioWorkletNode | null>(null);
  
  // Dual mic buffers
  const nurseSentenceBufferRef = useRef<Float32Array[]>([]);
  const patientSentenceBufferRef = useRef<Float32Array[]>([]);
  const nurseIsSpeakingRef = useRef<boolean>(false);
  const patientIsSpeakingRef = useRef<boolean>(false);
  const nurseLastSpeechTimeRef = useRef<number>(0);
  const patientLastSpeechTimeRef = useRef<number>(0);
  const nurseSpeechStartTimeRef = useRef<number>(0);
  const patientSpeechStartTimeRef = useRef<number>(0);
  const nurseSentenceEndTriggeredRef = useRef<boolean>(false);
  const patientSentenceEndTriggeredRef = useRef<boolean>(false);
  const nursePartialMessageIdRef = useRef<number | null>(null);
  const patientPartialMessageIdRef = useRef<number | null>(null);
  
  // Save mirror setting to localStorage
  useEffect(() => {
    localStorage.setItem("mirror-foreign-view", mirrorForeignView.toString());
  }, [mirrorForeignView]);
  
  // Save dual mic settings to localStorage
  useEffect(() => {
    localStorage.setItem("dual-mic-mode", dualMicMode.toString());
  }, [dualMicMode]);
  
  useEffect(() => {
    if (nurseMicId) localStorage.setItem("nurse-mic-id", nurseMicId);
  }, [nurseMicId]);
  
  useEffect(() => {
    if (patientMicId) localStorage.setItem("patient-mic-id", patientMicId);
  }, [patientMicId]);
  
  // Load available microphones
  useEffect(() => {
    const loadMicrophones = async () => {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(device => device.kind === "audioinput");
        setAvailableMics(mics);
        console.log("[Dual Mic] Available microphones:", mics.map(m => ({ id: m.deviceId, label: m.label })));
      } catch (error) {
        console.error("[Dual Mic] Error loading microphones:", error);
      }
    };
    loadMicrophones();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener("devicechange", loadMicrophones);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadMicrophones);
    };
  }, []);
  
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

  // Get current ASR mode config (must be before all useCallback that use these values)
  const currentConfig = getASRModeConfig(asrMode);
  
  // Use custom VAD parameters from localStorage if available, otherwise use config defaults
  const RMS_THRESHOLD = (() => {
    const saved = localStorage.getItem("vad-rms-threshold");
    return saved ? parseFloat(saved) : currentConfig.rmsThreshold;
  })();
  
  const SILENCE_DURATION_MS = (() => {
    const saved = localStorage.getItem("vad-silence-duration");
    return saved ? parseInt(saved) : currentConfig.silenceDurationMs;
  })();
  
  const MIN_SPEECH_DURATION_MS = (() => {
    const saved = localStorage.getItem("vad-min-speech-duration");
    return saved ? parseInt(saved) : currentConfig.minSpeechDurationMs;
  })();
  const PARTIAL_CHUNK_INTERVAL_MS = currentConfig.partialChunkIntervalMs;
  const PARTIAL_CHUNK_MIN_DURATION_MS = currentConfig.partialChunkMinDurationMs;
  const PARTIAL_CHUNK_MIN_BUFFERS = currentConfig.partialChunkMinBuffers;
  const FINAL_MIN_DURATION_MS = currentConfig.finalMinDurationMs;
  const FINAL_MAX_DURATION_MS = currentConfig.finalMaxDurationMs;

  // Show backend indicator
  useEffect(() => {
    console.log(`[Backend] Current backend: ${backend}`);
  }, [backend]);

  // Check audio level (VAD)
  const checkAudioLevel = useCallback(() => {
    if (!analyserRef.current) {
      console.warn("[VAD] analyserRef is null");
      return false;
    }

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

    // Log RMS value every 2 seconds for debugging
    if (Date.now() % 2000 < 100) {
      console.log(`[VAD] RMS: ${rms.toFixed(4)}, Threshold: ${RMS_THRESHOLD.toFixed(4)}, Speaking: ${rms > RMS_THRESHOLD}`);
    }

    // Update audio level display
    setAudioLevel(rms / RMS_THRESHOLD);

    return rms > RMS_THRESHOLD;
  }, [RMS_THRESHOLD]);

  // Process partial chunk for immediate subtitle (250-350ms, update same message, no translation)
  const processPartialChunk = useCallback(async (pcmBuffer: Float32Array[]) => {
    if (pcmBuffer.length === 0) return;

    // 🔥 OPTIMIZATION #4: Do NOT send ASR during silent loop
    if (!isSpeakingRef.current) {
      console.log(`⚠️ [Subtitle] Not speaking, skipping partial ASR`);
      return;
    }

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

        // Skip if blob is too small (< 1KB ≈ 0.15 seconds)
        if (webmBlob.size < 1000) {
          console.warn(`[Subtitle] Blob too small (${webmBlob.size} bytes < 1000 bytes), skipping`);
          setProcessingStatus("listening");
          return;
        }

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
                  preferredTargetLang: targetLanguage === "auto" ? undefined : targetLanguage,
                  transcriptOnly: true, // Partial: only transcription, no translation
                  asrMode,
                  asrModel, // Pass ASR model to backend
                })
              : await callGoTranslation({
                  audioBase64: base64Audio,
                  filename: `subtitle-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage === "auto" ? undefined : targetLanguage,
                  transcriptOnly: true, // Partial: only transcription, no translation
                });

            if (result.success && result.sourceText) {
              // 🔥 Filter Whisper hallucination (repeated strings)
              const isHallucination = detectWhisperHallucination(result.sourceText);
              if (isHallucination) {
                console.warn(`[Partial] Whisper hallucination detected, skipping: "${result.sourceText.substring(0, 50)}..."`);
                return;
              }
              
              // Update existing partial message (NEVER create new message)
              if (partialMessageIdRef.current !== null) {
                setConversations((prev) =>
                  prev.map((msg) =>
                    msg.id === partialMessageIdRef.current
                      ? { ...msg, originalText: result.sourceText || "", timestamp: new Date() }
                      : msg
                  )
                );
                console.log(`[Partial] Updated partial message #${partialMessageIdRef.current}: "${result.sourceText}"`);
                setCurrentSubtitle(result.sourceText);
              } else {
                console.warn(`[Partial] No partial message to update, skipping`);
              }
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

    // 🔥 OPTIMIZATION #3: Filter noise/silence WebM
    // Check 1: Buffer length (too short = noise)
    if (pcmBuffer.length < 12) {
      console.log(`⚠️ [Translation] Buffer too short (${pcmBuffer.length} buffers < 12), skipping as noise`);
      setProcessingStatus("listening");
      return;
    }

    // Note: RMS check removed from translation stage
    // Noise/silence filtering should only happen at VAD stage and before final chunk generation
    // If Whisper successfully transcribes text, we should NOT filter it based on RMS
    
    // Concatenate PCM buffers
    const concatenated = new Float32Array(pcmBuffer.reduce((acc, buf) => acc + buf.length, 0));
    let offset = 0;
    for (const buf of pcmBuffer) {
      concatenated.set(buf, offset);
      offset += buf.length;
    }

    // Calculate audio duration
    const totalSamples = concatenated.length;
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

        // Skip if blob is too small (< 1KB ≈ 0.15 seconds)
        if (webmBlob.size < 1000) {
          console.warn(`[Translation] Blob too small (${webmBlob.size} bytes < 1000 bytes), skipping`);
          setProcessingStatus("listening");
          return;
        }

        // Convert to base64 and send for translation
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];

          try {
            // Call backend based on selection
            // 🎙️ Dual Mic Mode: Add force language parameters
            const forceParams = dualMicMode ? {
              forceSourceLang: currentSpeaker === "nurse" ? "zh" : (targetLanguage === "auto" ? "vi" : targetLanguage),
              forceSpeaker: currentSpeaker,
            } : {};
            
            const result = backend === "nodejs"
              ? await translateMutation.mutateAsync({
                  audioBase64: base64Audio,
                  filename: `translation-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage === "auto" ? undefined : targetLanguage,
                  asrMode, // Pass ASR mode to backend
                  asrModel, // Pass ASR model to backend
                  ...forceParams, // Add force language params in dual mic mode
                })
              : await callGoTranslation({
                  audioBase64: base64Audio,
                  filename: `translation-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage === "auto" ? undefined : targetLanguage,
                });

            console.log("[Translation] Backend response:", result);
            
            if (result.success && result.sourceText) {
              // 🔥 Filter Whisper hallucination (repeated strings)
              const isHallucination = detectWhisperHallucination(result.sourceText);
              if (isHallucination) {
                console.warn(`[Final] Whisper hallucination detected, skipping: "${result.sourceText.substring(0, 50)}..."`);
                // Remove partial message if exists
                if (partialMessageIdRef.current !== null) {
                  setConversations((prev) => prev.filter((msg) => msg.id !== partialMessageIdRef.current));
                  console.log(`[ASR] Removed partial message #${partialMessageIdRef.current} (hallucination)`);
                  partialMessageIdRef.current = null;
                }
                setProcessingStatus("listening");
                return;
              }
              // 🔥 FIX: Separate source and target speakers
              const sourceSpeaker = result.direction === "nurse_to_patient" ? "nurse" : "patient";
              const targetSpeaker = result.direction === "nurse_to_patient" ? "patient" : "nurse";
              
              console.log(`[Speaker Logic] Direction: ${result.direction}, Source: ${sourceSpeaker}, Target: ${targetSpeaker}`);
              
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
                  speaker: sourceSpeaker, // Use source speaker for original text
                  originalText: result.sourceText,
                  translatedText: "",
                  detectedLanguage: result.sourceLang || "unknown",
                  timestamp: new Date(),
                  status: "final",
                };
                setConversations((prev) => [...prev, finalMessage]);
                console.log(`[Final] Created final message #${finalMessage.id}: "${result.sourceText}" (speaker: ${sourceSpeaker})`);
              }
              
              // Step 2: 非阻塞翻譯（async）
              if (result.translatedText) {
                // Translation already done, add translated message immediately
                // 🔥 FIX: Use sourceSpeaker so both original and translation appear on the same side (speaker's side)
                const translatedMessage: ConversationMessage = {
                  id: messageIdRef.current++,
                  speaker: sourceSpeaker, // 🔥 FIX: Use source speaker so translation appears on speaker's side
                  originalText: result.sourceText,
                  translatedText: result.translatedText,
                  detectedLanguage: result.sourceLang || "unknown",
                  timestamp: new Date(),
                  status: "translated",
                };
                setConversations((prev) => [...prev, translatedMessage]);
                console.log(`[Translated] Added translated message #${translatedMessage.id} (speaker: ${sourceSpeaker})`);
                
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
            console.warn("[Translation] No translation result:", errorMsg);
            console.warn("[Translation] Full response:", JSON.stringify(result, null, 2));
            // Only show error toast for real errors (not "No speech detected" or empty audio)
            if (!errorMsg.includes("No speech detected") && !errorMsg.includes("Audio too short")) {
              toast.error(`❌ 翻譯失敗: ${errorMsg}`);
            }
            setProcessingStatus("listening");
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
  }, [targetLanguage, translateMutation, dualMicMode, currentSpeaker, backend, asrMode, asrModel]);

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

      // Track 1: Partial chunks (300ms fixed) for immediate subtitle (only when speaking)
      const partialDuration = now - lastPartialTimeRef.current;
      if (partialDuration >= PARTIAL_CHUNK_INTERVAL_MS && isSpeakingRef.current && !sentenceEndTriggeredRef.current) {
        // Prohibit chunks < min buffers (prevent short chunks)
        if (sentenceBufferRef.current.length < PARTIAL_CHUNK_MIN_BUFFERS) {
          console.log(`⚠️ Partial chunk too short (${sentenceBufferRef.current.length} buffers < ${PARTIAL_CHUNK_MIN_BUFFERS}), discarding as noise`);
          lastPartialTimeRef.current = now;
          return;
        }
        
        // Check minimum chunk duration to avoid fragmentation
        const speechDuration = now - speechStartTimeRef.current;
        if (speechDuration >= PARTIAL_CHUNK_MIN_DURATION_MS && sentenceBufferRef.current.length > 0) {
          // Process partial chunk for subtitle (only use last 1 second of audio)
          // Calculate how many buffers = 1 second (48kHz * 1s / samples_per_buffer)
          // Assuming each buffer is ~960 samples (20ms at 48kHz), 1 second = ~50 buffers
          const BUFFERS_PER_SECOND = Math.ceil(SAMPLE_RATE / 960); // ~50 buffers for 1 second
          const recentBuffers = sentenceBufferRef.current.slice(-BUFFERS_PER_SECOND);
          
          console.log(`[Partial] Using last ${recentBuffers.length} buffers (out of ${sentenceBufferRef.current.length} total) for partial transcript`);
          processPartialChunk(recentBuffers);
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
          
          // 🔥 CRITICAL FIX: Force clear buffer when new speech starts
          sentenceBufferRef.current = [];
          partialMessageIdRef.current = null;
          lastPartialTimeRef.current = 0;
          console.log(`🔵 Speech started (buffer force-cleared)`);
          
          setProcessingStatus("vad-detected");
          
          // Create initial partial message (will be updated by processPartialChunk)
          if (partialMessageIdRef.current === null) {
            const newPartialMessage: ConversationMessage = {
              id: messageIdRef.current++,
              speaker: "nurse", // Assume nurse for now
              originalText: "",
              translatedText: "",
              detectedLanguage: "zh",
              timestamp: new Date(),
              status: "partial",
            };
            partialMessageIdRef.current = newPartialMessage.id;
            setConversations((prev) => [...prev, newPartialMessage]);
            console.log(`[Partial] Created initial partial message #${newPartialMessage.id}`);
          }
        }
        
        // Auto-cut if speech duration exceeds 4 seconds
        const speechDuration = now - speechStartTimeRef.current;
        if (speechDuration >= FINAL_MAX_DURATION_MS && !sentenceEndTriggeredRef.current) {
          console.log(`⚠️ Speech duration ${speechDuration}ms exceeds ${FINAL_MAX_DURATION_MS}ms, auto-cutting...`);
          sentenceEndTriggeredRef.current = true;
          isSpeakingRef.current = false;
          
          // Calculate final chunk duration
          const totalSamples = sentenceBufferRef.current.reduce((acc, buf) => acc + buf.length, 0);
          const finalChunkDuration = totalSamples / SAMPLE_RATE;
          
          console.log(`🟢 Speech auto-cut (duration: ${speechDuration}ms, final chunk: ${finalChunkDuration.toFixed(2)}s), processing final transcript...`);
          
          // Process final transcript (no upper limit check for auto-cut)
          if (sentenceBufferRef.current.length > 0) {
            processFinalTranscript([...sentenceBufferRef.current]);
          }
          
          // Reset state after final
          sentenceBufferRef.current = [];
          partialMessageIdRef.current = null;
          lastPartialTimeRef.current = 0;
          setProcessingStatus("listening");
        }
      } else {
        if (isSpeakingRef.current && !sentenceEndTriggeredRef.current) {
          const silenceDuration = now - lastSpeechTimeRef.current;
          if (silenceDuration >= SILENCE_DURATION_MS) {
            // Check minimum speech duration to filter short noise (800ms, prevent Whisper hallucination)
            const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current;
            
            // Check minimum speech duration to filter short noise
            if (speechDuration < MIN_SPEECH_DURATION_MS) {
              // Too short, likely noise - discard
              console.log(`⚠️ Speech too short (${speechDuration}ms < ${MIN_SPEECH_DURATION_MS}ms), discarding as noise`);
              
              // Remove the partial message from UI (if exists)
              if (partialMessageIdRef.current !== null) {
                setConversations((prev) => prev.filter((msg) => msg.id !== partialMessageIdRef.current));
                console.log(`[ASR] Removed partial message #${partialMessageIdRef.current} (speech too short)`);
              }
              
              isSpeakingRef.current = false;
              sentenceBufferRef.current = [];
              partialMessageIdRef.current = null;
              sentenceEndTriggeredRef.current = true;
              setProcessingStatus("listening");
            } else {
              // Valid speech duration, process final transcript
              // Note: No upper limit on speech duration - auto-cut handles long speech
              // Speech segment end (valid speech) - only trigger once
              sentenceEndTriggeredRef.current = true; // Set flag immediately to prevent multiple triggers
              isSpeakingRef.current = false;
              
              // Calculate final chunk duration
              const totalSamples = sentenceBufferRef.current.reduce((acc, buf) => acc + buf.length, 0);
              const finalChunkDuration = totalSamples / SAMPLE_RATE;
              
              console.log(`🟢 Speech ended (duration: ${speechDuration}ms, silence: ${silenceDuration}ms, final chunk: ${finalChunkDuration.toFixed(2)}s), processing final transcript ONCE...`);

              // Only process if final chunk >= minimum duration
              const finalMinDurationS = FINAL_MIN_DURATION_MS / 1000;
              const finalMaxDurationS = FINAL_MAX_DURATION_MS / 1000;
              
              if (finalChunkDuration >= finalMinDurationS) {
                // Process final transcript (only once)
                if (sentenceBufferRef.current.length > 0) {
                  // 🔥 OPTIMIZATION #1: Only take last 50-70 buffers (~1-1.5 seconds)
                  // This prevents Whisper hallucination and reduces processing time
                  const MAX_FINAL_BUFFERS = 70; // ~1.5 seconds at 48kHz
                  let finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
                  
                  const finalBufferDuration = finalBuffers.reduce((acc, buf) => acc + buf.length, 0) / SAMPLE_RATE;
                  console.log(`🔹 Final buffers: ${finalBuffers.length} buffers (~${finalBufferDuration.toFixed(2)}s)`);
                  
                  // Additional check: if still too long after slicing, something is wrong
                  if (finalBufferDuration > 2.0) {
                    console.warn(`⚠️ Final buffer still too long (${finalBufferDuration.toFixed(2)}s > 2.0s), this should not happen`);
                  }
                  
                  // Reset buffer and timer IMMEDIATELY (before processFinalTranscript starts)
                  // But DO NOT reset partialMessageIdRef yet - let processFinalTranscript handle it
                  sentenceBufferRef.current = [];
                  lastPartialTimeRef.current = 0;
                  console.log(`[ASR] Resetting segment state (buffer cleared, timer reset)`);
                  
                  // Now call async function with copied buffer
                  // processFinalTranscript will update the existing partial message to final
                  // and reset partialMessageIdRef.current after success
                  processFinalTranscript(finalBuffers);
                }
              } else {
                console.log(`⚠️ Final chunk duration ${finalChunkDuration.toFixed(2)}s < ${finalMinDurationS}s, discarding`);
                
                // Remove the partial message from UI (if exists) to avoid "stuck partial bubble"
                if (partialMessageIdRef.current !== null) {
                  setConversations((prev) => prev.filter((msg) => msg.id !== partialMessageIdRef.current));
                  console.log(`[ASR] Removed partial message #${partialMessageIdRef.current} (chunk too short)`);
                }
                
                // Reset state when discarding
                sentenceBufferRef.current = [];
                partialMessageIdRef.current = null;
                lastPartialTimeRef.current = 0;
              }
              
              setProcessingStatus("listening");
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

    // 🔥 FIX: Remove any partial messages from UI when stopping Hybrid recording
    // Always remove all partial messages, regardless of partialMessageIdRef state
    setConversations((prev) => {
      const partialCount = prev.filter((msg) => msg.status === "partial").length;
      if (partialCount > 0) {
        console.log(`[Stop Hybrid Recording] Removing ${partialCount} partial message(s)`);
        return prev.filter((msg) => msg.status !== "partial");
      }
      return prev;
    });
    partialMessageIdRef.current = null;
    lastPartialTimeRef.current = 0;
    sentenceEndTriggeredRef.current = false;

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
        targetLanguage: targetLanguage === "auto" ? "auto" : targetLanguage,
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

    // 🔥 FIX: Remove any partial messages from UI when stopping recording
    // Always remove all partial messages, regardless of partialMessageIdRef state
    setConversations((prev) => {
      const partialCount = prev.filter((msg) => msg.status === "partial").length;
      if (partialCount > 0) {
        console.log(`[Stop Recording] Removing ${partialCount} partial message(s)`);
        return prev.filter((msg) => msg.status !== "partial");
      }
      return prev;
    });
    partialMessageIdRef.current = null;
    lastPartialTimeRef.current = 0;
    sentenceEndTriggeredRef.current = false;

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
            {/* Settings Button */}
            <Link href="/settings">
              <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                <SettingsIcon className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </Link>
            
            {/* ASR Mode Selector */}
            <Select value={asrMode} onValueChange={(value) => setAsrMode(value as ASRMode)} disabled={isRecording}>
              <SelectTrigger className="w-[100px] md:w-[140px] bg-gray-900 border-gray-700 text-sm md:text-base">
                <SelectValue placeholder="模式" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="normal">
                  <div className="flex flex-col">
                    <span>💨 快速</span>
                    <span className="text-xs text-gray-400">0.6-1.2s</span>
                  </div>
                </SelectItem>
                <SelectItem value="precise">
                  <div className="flex flex-col">
                    <span>🎯 精確</span>
                    <span className="text-xs text-gray-400">1.0-2.0s</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Target Language Selector */}
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
            <Link href="/conversations">
              <Button variant="outline" size="sm" className="h-8 md:h-10 text-xs md:text-sm">
                <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden md:inline">對話管理</span>
              </Button>
            </Link>
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
          <div className="bg-gray-900 rounded-2xl p-3 md:p-4 md:rotate-0 rotate-180">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-center">台灣人 (中文)</h2>
            <div ref={nurseScrollRef} className="h-[250px] md:h-[400px] overflow-y-auto space-y-3 md:space-y-4">
              {/* Partial transcript (即時字幕) */}
              {conversations
                .filter((msg) => msg.speaker === "nurse" && msg.status === "partial")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800/70 p-3 md:p-4 rounded-2xl border-l-4 border-yellow-500">
                    <div className="text-xs text-yellow-400 mb-2 flex items-center gap-2">
                      <span className="animate-pulse">●</span>
                      即時字幕
                    </div>
                    <div className="font-medium text-base md:text-lg text-gray-200 italic">
                      {msg.originalText || "偵測中..."}
                    </div>
                  </div>
                ))}
              
              {/* Translated messages (翻譯結果) - iPhone 風格泡泡 */}
              {conversations
                .filter((msg) => msg.speaker === "nurse" && msg.status === "translated")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-4 md:p-5 rounded-2xl shadow-lg">
                    {/* 原文 - 白色 */}
                    <div className="font-semibold text-lg md:text-xl text-white mb-3 leading-relaxed">
                      {msg.originalText}
                    </div>
                    {/* 分隔線 */}
                    <div className="border-t border-gray-600 my-3"></div>
                    {/* 翻譯 - 青色 */}
                    <div className="font-medium text-lg md:text-xl text-cyan-400 leading-relaxed">
                      {msg.translatedText}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Patient (Foreign Language) - Top on mobile (normal, facing down), Right on desktop */}
          <div className="bg-gray-900 rounded-2xl p-3 md:p-4">
            <div className="flex items-center justify-center gap-3 mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-semibold">外國人 (外語)</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMirrorForeignView(!mirrorForeignView)}
                className="h-7 px-2 text-xs"
                title={mirrorForeignView ? "取消翻轉顯示" : "翻轉顯示（透明螢幕）"}
              >
                {mirrorForeignView ? "🔄 已翻轉" : "↔️ 翻轉"}
              </Button>
            </div>
            <div 
              ref={patientScrollRef} 
              className={`h-[250px] md:h-[400px] overflow-y-auto space-y-3 md:space-y-4 ${mirrorForeignView ? 'mirror-horizontal' : ''}`}
            >
              {/* Partial transcript (即時字幕) */}
              {conversations
                .filter((msg) => msg.speaker === "patient" && msg.status === "partial")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800/70 p-3 md:p-4 rounded-2xl border-l-4 border-yellow-500">
                    <div className="text-xs text-yellow-400 mb-2 flex items-center gap-2">
                      <span className="animate-pulse">●</span>
                      即時字幕
                    </div>
                    <div className="font-medium text-base md:text-lg text-gray-200 italic">
                      {msg.originalText || "偵測中..."}
                    </div>
                  </div>
                ))}
              
              {/* Translated messages (翻譯結果) - iPhone 風格泡泡 */}
              {conversations
                .filter((msg) => msg.speaker === "patient" && msg.status === "translated")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-4 md:p-5 rounded-2xl shadow-lg">
                    {/* 原文 - 白色 */}
                    <div className="font-semibold text-lg md:text-xl text-white mb-3 leading-relaxed">
                      {msg.originalText}
                    </div>
                    {/* 分隔線 */}
                    <div className="border-t border-gray-600 my-3"></div>
                    {/* 翻譯 - 青色 */}
                    <div className="font-medium text-lg md:text-xl text-cyan-400 leading-relaxed">
                      {msg.translatedText}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* 🎙️ Manual Speaker Mode (Simplified Dual Mic) */}
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dualMicMode}
                onChange={(e) => setDualMicMode(e.target.checked)}
                disabled={isRecording}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm md:text-base">🎙️ 手動切換說話者模式</span>
            </label>
          </div>
          
          {dualMicMode && (
            <div className="bg-gray-900 rounded-xl p-4 max-w-md mx-auto">
              <div className="text-center mb-3 text-sm text-gray-400">
                點擊下方按鈕切換當前說話者
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={currentSpeaker === "nurse" ? "default" : "outline"}
                  onClick={() => setCurrentSpeaker("nurse")}
                  className={`py-6 text-lg ${
                    currentSpeaker === "nurse" 
                      ? "bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-400" 
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-2xl mb-1">🇹🇼</span>
                    <span>台灣人</span>
                    <span className="text-xs opacity-70">（中文）</span>
                  </div>
                </Button>
                <Button
                  variant={currentSpeaker === "patient" ? "default" : "outline"}
                  onClick={() => setCurrentSpeaker("patient")}
                  className={`py-6 text-lg ${
                    currentSpeaker === "patient" 
                      ? "bg-green-600 hover:bg-green-700 ring-2 ring-green-400" 
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-2xl mb-1">🌏</span>
                    <span>外國人</span>
                    <span className="text-xs opacity-70">（{LANGUAGE_OPTIONS.find(l => l.value === targetLanguage)?.label || '外語'}）</span>
                  </div>
                </Button>
              </div>
              
              {/* Current speaker indicator */}
              <div className={`mt-4 text-center py-2 rounded-lg ${
                currentSpeaker === "nurse" 
                  ? "bg-blue-900/50 text-blue-300" 
                  : "bg-green-900/50 text-green-300"
              }`}>
                當前說話者：{currentSpeaker === "nurse" ? "🇹🇼 台灣人（中文）" : `🌏 外國人（${LANGUAGE_OPTIONS.find(l => l.value === targetLanguage)?.label || '外語'}）`}
              </div>
              
              {/* Info */}
              <div className="mt-3 text-gray-500 text-xs text-center">
                💡 手動切換模式可以避免語言偵測錯誤，確保翻譯方向正確
              </div>
            </div>
          )}
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
