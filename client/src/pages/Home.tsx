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
import { VAD_CONFIG, ASR_CONFIG, AUDIO_CONFIG, ASR_MODE_CONFIG, WHISPER_CONFIG, TRANSLATION_CONFIG, type ASRMode, getASRModeConfig } from "@shared/config";
// v2.2.0: 移除 TranslationStatusBadge（Quality Pass 已停用）

type ConversationMessage = {
  id: number;
  speaker: "nurse" | "patient";
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  timestamp: Date;
  status: "partial" | "final"; // v2.2.0: 簡化，移除 "translated" 狀態
  finalized?: boolean; // v2.3.0: 標記是否已產生 final transcript，保護免被 cleanup 清除
  // 翻譯相關（保留）
  sourceLang?: string; // 原文語言
  targetLang?: string; // 目標語言
  // 對話記錄相關（保留）
  conversationId: number | null; // 對話 ID（DB），用於 saveTranslation
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
// v2.2.0: 移除 QUALITY_PASS_TIMEOUT_MS（Quality Pass 已停用）

/**
 * Detect Whisper hallucination and non-transcription output
 * Common patterns:
 * - "Ch-Ch-Ch-Ch-Ch-Ch..." (repeated syllables)
 * - "謝謝,謝謝,謝謝,謝謝..." (repeated words)
 * - "Thank you, thank you, thank you..." (repeated phrases)
 * - "Speaker likely speaks Chinese, Vietnamese..." (language detection output)
 * - "The speaker is..." (speaker description)
 * - "This audio..." (audio description)
 */
function detectWhisperHallucination(text: string): boolean {
  if (!text || text.trim() === "") {
    return true;
  }

  // 🆕 Pattern 1: Known hallucination phrases (YouTube, Podcast, Amara subtitles)
  const knownHallucinationPhrases = [
    "請不吝點讚",
    "訂閱轉發",
    "打賞支持",
    "明鏡與點點欄目",
    "本期視頻拍到這裡",
    "Amara",
    "字幕",
    "Thank you for watching",
    "Don't forget to subscribe",
    "like and subscribe",
  ];
  for (const phrase of knownHallucinationPhrases) {
    if (text.includes(phrase)) {
      return true;
    }
  }

  // 🆕 Pattern 2: Repeated short patterns (e.g., "謝謝,謝謝,謝謝..." or "Ch-Ch-Ch-Ch...")
  const repeatedPatterns = [
    /(.{1,5})[,，]\1[,，]\1/, // Repeated 1-5 char patterns with comma (e.g., "謝謝,謝謝,謝謝")
    /(.{1,3})-\1-\1/,          // Repeated 1-3 char patterns with dash (e.g., "Ch-Ch-Ch" or "Ah-Ah-Ah")
  ];
  for (const pattern of repeatedPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // 🆕 Pattern 3: Single repeated character (e.g., "AAAAA", "嗯嗯嗯嗯嗯")
  if (/^(.)\1{4,}$/.test(text)) {
    return true;
  }
  
  // 🆕 Pattern 4: Prompt/Context leak detection
  const promptLeakPatterns = [
    /^context:/i,              // Prompt/context leak: "context: ..."
    /^###/i,                   // Markdown header leak: "### ..."
    /User is speaking/i,       // Prompt leak: "User is speaking..."
    /Prioritize.*detection/i,  // Prompt leak: "Prioritize Chinese detection"
  ];
  for (const pattern of promptLeakPatterns) {
    if (pattern.test(text)) {
      console.warn(`[Whisper Hallucination] Detected prompt/context leak: "${text}"`);
      return true;
    }
  }
  
  // 🆕 Pattern 5: Non-transcription output (language detection, speaker description, audio description)
  const nonTranscriptionPatterns = [
    /Speaker likely speaks/i,
    /The speaker is/i,
    /This audio/i,
    /說話者可能說/i, // Chinese: "Speaker likely speaks"
    /這段音頻/i, // Chinese: "This audio"
  ];
  for (const pattern of nonTranscriptionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // 🆕 Pattern 6: Very short text with multiple language names (e.g., "Chinese, Vietnamese, English, Indonesian")
  if (text.length < 100) {
    const languageNames = [
      "Chinese", "Vietnamese", "English", "Indonesian", "Filipino", "Thai", "Japanese", "Korean",
      "中文", "越南語", "英語", "印尼語", "菲律賓語", "泰語", "日語", "韓語",
    ];
    let languageCount = 0;
    for (const lang of languageNames) {
      if (text.includes(lang)) {
        languageCount++;
      }
    }
    // If text contains 3+ language names, it's likely a language detection output
    if (languageCount >= 3) {
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
  const [currentConversationKey, setCurrentConversationKey] = useState<string | null>(null); // UUID for Race Condition guard
  // v2.2.0: 移除 currentConversationKeyRef（Quality Pass 已停用）
  
  // 對話 context 管理（最近 3-6 句）
  const conversationContextRef = useRef<Array<{speaker: "nurse" | "patient", originalText: string, translatedText: string}>>([]);
  const MAX_CONTEXT_SIZE = 6; // 最多保留 6 句對話
  
  // Backend selection: "nodejs" | "go" | "hybrid"
  const [backend, setBackend] = useState<"nodejs" | "go" | "hybrid">(() => {
    const saved = localStorage.getItem("translation-backend");
    return (saved === "go" || saved === "nodejs" || saved === "hybrid") ? saved : "nodejs";
  });
  
  // ASR mode selection: "normal" | "precise" (read from localStorage, set in Settings page)
  const [asrMode] = useState<ASRMode>(() => {
    const saved = localStorage.getItem("asr-mode");
    return (saved === "normal" || saved === "precise") ? saved : "normal";
  });
  
  // ASR model selection: "gpt-4o-mini-transcribe" | "gpt-4o-transcribe"
  const [asrModel, setAsrModel] = useState<string>(() => {
    const saved = localStorage.getItem("asr-model");
    return saved || WHISPER_CONFIG.MODEL;
  });
  
  // Save ASR model to localStorage when changed
  useEffect(() => {
    localStorage.setItem("asr-model", asrModel);
  }, [asrModel]);
  
  // Translation model selection
  const [translationModel] = useState<string>(() => {
    const saved = localStorage.getItem("translation-model");
    return saved || TRANSLATION_CONFIG.LLM_MODEL;
  });
  
  // Hybrid ASR client
  const hybridClientRef = useRef<HybridASRClient | null>(null);
  const [isHybridConnected, setIsHybridConnected] = useState(false);

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
  
  // 🆕 Segment mechanism for race condition prevention
  const currentSegmentIdRef = useRef<number>(0); // Auto-incrementing segment ID
  const activeSegmentsRef = useRef<Set<number>>(new Set()); // Track active segments
  const cancelledSegmentsRef = useRef<Set<number>>(new Set()); // Track cancelled segments
  const audioFrozenSegmentsRef = useRef<Set<number>>(new Set()); // Track segments with frozen audio pipeline
  const endTriggeredSegmentsRef = useRef<Set<number>>(new Set()); // Track segments that have triggered END event
  const finalAbortControllersRef = useRef<Map<number, AbortController>>(new Map()); // segmentId -> AbortController for final requests

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
  
  // Final buffer: Accumulated audio for final transcript (will be hard-trimmed before sending)
  const sentenceBufferRef = useRef<Float32Array[]>([]); // Buffer for final transcript
  
  const processSentenceForTranslationRef = useRef<((pcmBuffer: Float32Array[], segmentId: number) => Promise<void>) | null>(null);
  const sentenceEndTriggeredRef = useRef<boolean>(false); // Prevent multiple sentence end triggers

  // tRPC mutations (for Node.js backend)
  const translateMutation = trpc.translation.autoTranslate.useMutation();
  // v2.2.0: 移除 qualityPassMutation（Quality Pass 已停用）
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
  
  // v1.5.4: VAD parameters now come exclusively from ASR_MODE_CONFIG
  // No more localStorage overrides - single source of truth
  const VAD_START_THRESHOLD = currentConfig.vadStartThreshold;
  const VAD_END_THRESHOLD = currentConfig.vadEndThreshold;
  const VAD_START_FRAMES = currentConfig.vadStartFrames;
  const VAD_END_FRAMES = currentConfig.vadEndFrames;
  const RMS_THRESHOLD = currentConfig.rmsThreshold;
  const SILENCE_DURATION_MS = currentConfig.silenceDurationMs;
  const MIN_SPEECH_DURATION_MS = currentConfig.minSpeechDurationMs;
  const PARTIAL_CHUNK_INTERVAL_MS = currentConfig.partialChunkIntervalMs;
  const PARTIAL_CHUNK_MIN_DURATION_MS = currentConfig.partialChunkMinDurationMs;
  const PARTIAL_CHUNK_MIN_BUFFERS = currentConfig.partialChunkMinBuffers;
  const FINAL_MIN_DURATION_MS = currentConfig.finalMinDurationMs;
  const FINAL_MAX_DURATION_MS = currentConfig.finalMaxDurationMs;
  
  // 🆕 Dual-threshold VAD state tracking
  const vadStartFrameCountRef = useRef<number>(0); // Count consecutive frames above start threshold
  const vadEndFrameCountRef = useRef<number>(0); // Count consecutive frames below end threshold

  // Show backend indicator
  useEffect(() => {
    console.log(`[Backend] Current backend: ${backend}`);
  }, [backend]);

  // Check audio level (VAD)
  // 🆕 Dual-threshold VAD with hysteresis to prevent oscillation
  const lastRmsLogTimeRef = useRef<number>(0); // For RMS diagnostic logging
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
    
    // 🔍 Diagnostic: Log RMS value every 2 seconds
    const now = Date.now();
    if (now - lastRmsLogTimeRef.current >= 2000) {
      console.log(`[VAD/Diagnostic] RMS: ${rms.toFixed(4)}, Start threshold: ${VAD_START_THRESHOLD.toFixed(4)}, End threshold: ${VAD_END_THRESHOLD.toFixed(4)}, Speaking: ${isSpeakingRef.current}`);
      lastRmsLogTimeRef.current = now;
    }

    // Update audio level display (use start threshold as reference)
    setAudioLevel(rms / VAD_START_THRESHOLD);

    // Dual-threshold logic with consecutive frame counting
    const currentlySpeaking = isSpeakingRef.current;
    
    if (!currentlySpeaking) {
      // Not speaking: check if RMS exceeds START threshold
      if (rms > VAD_START_THRESHOLD) {
        vadStartFrameCountRef.current++;
        vadEndFrameCountRef.current = 0; // Reset end counter
        
        // Need consecutive frames above start threshold to trigger speech start
        if (vadStartFrameCountRef.current >= VAD_START_FRAMES) {
          // Log RMS value when speech starts
          console.log(`[VAD] 🔊 Speech START detected: RMS=${rms.toFixed(4)} > startThreshold=${VAD_START_THRESHOLD.toFixed(4)} (${vadStartFrameCountRef.current} consecutive frames)`);
          vadStartFrameCountRef.current = 0; // Reset for next detection
          return true; // Speech started
        }
      } else {
        vadStartFrameCountRef.current = 0; // Reset if RMS drops below start threshold
      }
      return false; // Still not speaking
    } else {
      // Currently speaking: check if RMS drops below END threshold
      if (rms < VAD_END_THRESHOLD) {
        vadEndFrameCountRef.current++;
        vadStartFrameCountRef.current = 0; // Reset start counter
        
        // Need consecutive frames below end threshold to trigger speech end
        if (vadEndFrameCountRef.current >= VAD_END_FRAMES) {
          const currentSegmentId = currentSegmentIdRef.current;
          
          // 🚧 Prevent duplicate END events for the same segment
          if (endTriggeredSegmentsRef.current.has(currentSegmentId)) {
            console.log(`[VAD] ⚠️ Speech END already triggered for Segment#${currentSegmentId}, ignoring duplicate`);
            return false; // Already triggered, ignore
          }
          
          // Log RMS value when speech ends
          console.log(`[VAD] 🔇 Speech END detected: RMS=${rms.toFixed(4)} < endThreshold=${VAD_END_THRESHOLD.toFixed(4)} (${vadEndFrameCountRef.current} consecutive frames)`);
          vadEndFrameCountRef.current = 0; // Reset for next detection
          
          // 🔒 Mark END as triggered for this segment
          endTriggeredSegmentsRef.current.add(currentSegmentId);
          
          // 🧊 Freeze audio pipeline for this segment
          audioFrozenSegmentsRef.current.add(currentSegmentId);
          console.log(`🟫 [VAD/Segment#${currentSegmentId}] Speech END detected, freezing audio pipeline`);
          
          // 🎯 Immediately trigger final transcript processing
          if (sentenceBufferRef.current.length > 0) {
            console.log(`🟢 [VAD/Segment#${currentSegmentId}] Triggering final transcript (Speech END finalize)`);
            // Use current sentenceBufferRef content
            const finalBuffers = [...sentenceBufferRef.current];
            
            // 🔥 Hard-trim to ensure duration ≤ maxFinalSec
            const totalSamples = finalBuffers.reduce((acc, buf) => acc + buf.length, 0);
            const totalDurationSec = totalSamples / SAMPLE_RATE;
            const maxFinalSec = FINAL_MAX_DURATION_MS / 1000; // Convert ms to seconds
            
            if (totalDurationSec > maxFinalSec) {
              const maxSamples = Math.floor(maxFinalSec * SAMPLE_RATE);
              let currentSamples = 0;
              const trimmedBuffers: Float32Array[] = [];
              
              // Take from the end (most recent audio)
              for (let i = finalBuffers.length - 1; i >= 0; i--) {
                const buf = finalBuffers[i];
                if (currentSamples + buf.length <= maxSamples) {
                  trimmedBuffers.unshift(buf);
                  currentSamples += buf.length;
                } else {
                  const remaining = maxSamples - currentSamples;
                  if (remaining > 0) {
                    const trimmed = buf.slice(buf.length - remaining);
                    trimmedBuffers.unshift(trimmed);
                    currentSamples += trimmed.length;
                  }
                  break;
                }
              }
              
              const trimmedDurationSec = currentSamples / SAMPLE_RATE;
              console.log(`✏️ [VAD/Segment#${currentSegmentId}] Hard-trimmed final chunk: ${totalDurationSec.toFixed(2)}s → ${trimmedDurationSec.toFixed(2)}s (max: ${maxFinalSec}s)`);
              processFinalTranscript(trimmedBuffers, currentSegmentId);
            } else {
              processFinalTranscript(finalBuffers, currentSegmentId);
            }
          } else {
            console.warn(`⚠️ [VAD/Segment#${currentSegmentId}] Speech END detected but sentenceBuffer is empty`);
          }
          
          // 🔄 Reset isSpeakingRef to allow next Speech START
          isSpeakingRef.current = false;
          console.log(`🔄 [VAD/Segment#${currentSegmentId}] Reset isSpeakingRef, ready for next speech`);
          
          return false; // Speech ended
        }
      } else {
        vadEndFrameCountRef.current = 0; // Reset if RMS rises above end threshold
      }
      return true; // Still speaking
    }
  }, [VAD_START_THRESHOLD, VAD_END_THRESHOLD, VAD_START_FRAMES, VAD_END_FRAMES]);

  // Process partial chunk for immediate subtitle (250-350ms, update same message, no translation)
  // processPartialChunk removed - VAD-only segmentation (no partial ASR)

  // Process final transcript (覆蓋 partial) + 非阻塞翻譯
  const processFinalTranscript = useCallback(async (pcmBuffer: Float32Array[], segmentId: number) => {
    if (pcmBuffer.length === 0) return;

    // 🔒 Segment guard: Check if segment is still active
    if (cancelledSegmentsRef.current.has(segmentId)) {
      console.log(`⚠️ [Final/Segment#${segmentId}] Segment cancelled, ignoring final request`);
      return;
    }
    
    if (!activeSegmentsRef.current.has(segmentId)) {
      console.log(`⚠️ [Final/Segment#${segmentId}] Segment not active, ignoring final request`);
      return;
    }

    // 🔥 OPTIMIZATION #3: Filter noise/silence WebM
    // Check 1: Buffer length (too short = noise)
    if (pcmBuffer.length < 12) {
      console.log(`⚠️ [Translation/Segment#${segmentId}] Buffer too short (${pcmBuffer.length} buffers < 12), skipping as noise`);
      setProcessingStatus("listening");
      return;
    }
    
    // Create AbortController for this final request
    const abortController = new AbortController();
    finalAbortControllersRef.current.set(segmentId, abortController);

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

    const bufferDurationMs = audioDuration * 1000;
    console.log(`[Translation] Processing sentence with ${pcmBuffer.length} PCM buffers (${totalSamples} samples, ${bufferDurationMs.toFixed(0)}ms = ${audioDuration.toFixed(2)}s)`);
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
            
            // Log selected models for debugging
            console.log(`[Frontend] 🎤 ASR Model: ${asrModel} (mode: ${asrMode})`);
            console.log(`[Frontend] 🌐 Translation Model: ${translationModel}`);
            console.log(`[Frontend] 🔧 Backend: ${backend}`);
            
            const result = backend === "nodejs"
              ? await translateMutation.mutateAsync({
                  audioBase64: base64Audio,
                  filename: `translation-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage === "auto" ? undefined : targetLanguage,
                  asrMode, // Pass ASR mode to backend
                  asrModel, // Pass ASR model to backend
                  translationModel, // Pass Translation model to backend
                  ...forceParams, // Add force language params in dual mic mode
                })
              : await callGoTranslation({
                  audioBase64: base64Audio,
                  filename: `translation-${Date.now()}.webm`,
                  preferredTargetLang: targetLanguage === "auto" ? undefined : targetLanguage,
                });

            // 🔒 Segment guard: Check if segment is still active before processing response
            if (cancelledSegmentsRef.current.has(segmentId)) {
              console.log(`⚠️ [Final/Segment#${segmentId}] Segment cancelled, ignoring translation response`);
              return;
            }
            
            if (!activeSegmentsRef.current.has(segmentId)) {
              console.log(`⚠️ [Final/Segment#${segmentId}] Segment not active, ignoring translation response`);
              return;
            }

            console.log("[Translation] Backend response:", result);
            console.log(`[Frontend] ✅ Received: sourceLang=${result.sourceLang}, targetLang=${result.targetLang}, direction=${result.direction}`);
            console.log(`[Frontend] 📝 Source text: "${result.sourceText?.substring(0, 50)}${(result.sourceText?.length || 0) > 50 ? '...' : ''}"`);
            
            if (result.success && result.sourceText) {
              // 🔥 Filter Whisper hallucination (repeated strings)
              const isHallucination = detectWhisperHallucination(result.sourceText);
              if (isHallucination) {
                console.warn(`[Final] Whisper hallucination detected, skipping: "${result.sourceText.substring(0, 50)}..."`);
                setProcessingStatus("listening");
                return;
              }
              // 🔥 FIX: Separate source and target speakers
              const sourceSpeaker = result.direction === "nurse_to_patient" ? "nurse" : "patient";
              const targetSpeaker = result.direction === "nurse_to_patient" ? "patient" : "nurse";
              
              console.log(`[Speaker Logic] Direction: ${result.direction}, Source: ${sourceSpeaker}, Target: ${targetSpeaker}`);
              
              // v2.2.0: 簡化翻譯流程（只使用 Fast Pass）
              if (result.translatedText) {
                // VAD-only: Always create new final message (no partial to update)
                const finalMessageId = messageIdRef.current++;
                const finalMessage: ConversationMessage = {
                  id: finalMessageId,
                  speaker: sourceSpeaker,
                  originalText: result.sourceText,
                  translatedText: result.translatedText,
                  detectedLanguage: result.sourceLang || "unknown",
                  timestamp: new Date(),
                  status: "final",
                  finalized: true, // v2.3.0: 標記為 finalized，保護免被 cleanup 清除
                  sourceLang: result.sourceLang,
                  targetLang: result.targetLang,
                  conversationId: currentConversationId,
                };
                setConversations((prev) => [...prev, finalMessage]);
                console.log(`[Translation] Created final translation #${finalMessageId} (speaker: ${sourceSpeaker}, finalized=true)`);
              }
              
              // v2.2.0: 移除 Quality Pass 邏輯，直接儲存翻譯結果
              // Save to database
              if (currentConversationId && result.translatedText) {
                saveTranslationMutation.mutate({
                  conversationId: currentConversationId,
                  direction: result.direction!,
                  sourceLang: result.sourceLang || "unknown",
                  targetLang: result.targetLang || targetLanguage,
                  sourceText: result.sourceText || "",
                  translatedText: result.translatedText,
                });
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

      // Track 1: Partial chunks removed - VAD-only segmentation
      
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
          
          // 🆕 Create new segment
          const newSegmentId = ++currentSegmentIdRef.current;
          activeSegmentsRef.current.add(newSegmentId);
          console.log(`🆕 [Segment#${newSegmentId}] Created new segment`);
          
          // 🔥 CRITICAL FIX: Force clear buffer when new speech starts
          sentenceBufferRef.current = []; // Clear final buffer
          
          // 🧊 Clear frozen/end flags for new segment (fresh start)
          // Note: Old segment flags remain in the Set for guard purposes
          // They will be cleaned up in stopRecording
          
          console.log(`🔵 [Segment#${newSegmentId}] Speech started (buffer force-cleared)`);
          
          setProcessingStatus("vad-detected");
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
          
          // Process final transcript (with hard-trim to ensure duration ≤ maxFinalSec)
          if (sentenceBufferRef.current.length > 0) {
            const currentSegmentId = currentSegmentIdRef.current;
            
            // 🆕 Hard-trim final chunk to ensure duration ≤ maxFinalSec (2.0s)
            const MAX_FINAL_DURATION_S = FINAL_MAX_DURATION_MS / 1000; // 2.0s from config
            let finalBuffers = sentenceBufferRef.current;
            
            // Calculate current duration
            const currentDuration = finalBuffers.reduce((acc, buf) => acc + buf.length, 0) / SAMPLE_RATE;
            
            if (currentDuration > MAX_FINAL_DURATION_S) {
              // Hard-trim: only take last MAX_FINAL_DURATION_S seconds
              const targetSamples = Math.floor(MAX_FINAL_DURATION_S * SAMPLE_RATE);
              let accumulatedSamples = 0;
              let startIndex = finalBuffers.length - 1;
              
              // Work backwards to find where to start
              for (let i = finalBuffers.length - 1; i >= 0; i--) {
                accumulatedSamples += finalBuffers[i].length;
                if (accumulatedSamples >= targetSamples) {
                  startIndex = i;
                  break;
                }
              }
              
              finalBuffers = finalBuffers.slice(startIndex);
              const trimmedDuration = finalBuffers.reduce((acc, buf) => acc + buf.length, 0) / SAMPLE_RATE;
              console.log(`✂️ [Auto-cut] Hard-trimmed from ${currentDuration.toFixed(2)}s to ${trimmedDuration.toFixed(2)}s (max: ${MAX_FINAL_DURATION_S}s)`);
            }
            
            processFinalTranscript(finalBuffers, currentSegmentId);
          }
          
          // Reset state after final
          sentenceBufferRef.current = [];
          setProcessingStatus("listening");
        }
      }
      // Note: Speech END is now handled exclusively by VAD in checkAudioLevel
      // The old silence-based detection has been removed to prevent duplicate processFinalTranscript calls
    }, 100);
  }, [checkAudioLevel, processFinalTranscript]);

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
      // VAD-only: No partial transcript handling
      client.onPartialTranscript = (data) => {
        // Ignored in VAD-only mode
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
          status: "final",
          conversationId: currentConversationId,
        };
        
        setConversations((prev) => [...prev, newMessage]);
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
    setCurrentSubtitle("");
    setProcessingStatus("idle");
    setIsRecording(false);

    // VAD-only: No partial messages to remove
    sentenceEndTriggeredRef.current = false;

    toast.success("停止 Hybrid ASR 錄音");
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // v2.2.0: 移除 conversationKey 生成（Quality Pass 已停用）

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
          
          // 🧊 Check if current segment is frozen (Speech END detected)
          const currentSegmentId = currentSegmentIdRef.current;
          const isAudioFrozen = audioFrozenSegmentsRef.current.has(currentSegmentId);
          
          if (isSpeakingRef.current && !isAudioFrozen) {
            // 🆕 Audio path separation: accumulate to both buffers
            sentenceBufferRef.current.push(event.data.data); // For final transcript
          } else if (isAudioFrozen) {
            // 🚧 Audio frozen, stop accumulating new audio
            // (Speech END has been triggered, waiting for final transcript to complete)
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
    
    // v2.2.0: 移除 conversationKey 清空（Quality Pass 已停用）
    
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

    // 🆕 Clean up all active segments
    console.log(`[Stop Recording] Cleaning up ${activeSegmentsRef.current.size} active segments`);
    activeSegmentsRef.current.forEach((segmentId) => {
      // Abort all pending requests for this segment
      const finalAbortController = finalAbortControllersRef.current.get(segmentId);
      if (finalAbortController) {
        finalAbortController.abort();
        finalAbortControllersRef.current.delete(segmentId);
      }
      
      // Mark segment as cancelled
      cancelledSegmentsRef.current.add(segmentId);
    });
    activeSegmentsRef.current.clear();
    
    // 🧊 Clean up frozen/end flags
    audioFrozenSegmentsRef.current.clear();
    endTriggeredSegmentsRef.current.clear();
    
    // Clear buffers
    currentChunkBufferRef.current = [];
    sentenceBufferRef.current = [];
    isSpeakingRef.current = false;
    setAudioLevel(0);
    setCurrentSubtitle("");
    setProcessingStatus("idle");
    setIsRecording(false);

    // VAD-only: No partial messages to remove
    sentenceEndTriggeredRef.current = false;
    
    // Reset VAD frame counters
    vadStartFrameCountRef.current = 0;
    vadEndFrameCountRef.current = 0;

    // End conversation
    if (currentConversationId) {
      endConversationMutation.mutate({
        conversationId: currentConversationId,
      });
      console.log(`[Conversation] Ended conversation ID: ${currentConversationId}`);
      setCurrentConversationId(null);
    }

    toast.success("停止錄音");
  }, [stopVADMonitoring, currentConversationId, endConversationMutation, backend, stopHybridRecording]);

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
              {/* VAD-only: No partial transcript display */}
              
              {/* Translated messages (翻譯結果) - iPhone 風格泡泡 */}
              {conversations
                .filter((msg) => msg.speaker === "nurse" && msg.status === "final")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-4 md:p-5 rounded-2xl shadow-lg relative">
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
              {/* VAD-only: No partial transcript display */}
              
              {/* Translated messages (翻譯結果) - iPhone 風格泡泡 */}
              {conversations
                .filter((msg) => msg.speaker === "patient" && msg.status === "final")
                .map((msg) => (
                  <div key={msg.id} className="bg-gray-800 p-4 md:p-5 rounded-2xl shadow-lg relative">
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
