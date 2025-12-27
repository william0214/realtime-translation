/**
 * 即時雙向翻譯系統配置檔案
 * 集中管理所有 VAD、ASR 和翻譯相關參數
 */

// ==================== VAD (Voice Activity Detection) 參數 ====================

/**
 * VAD 配置
 * 控制語音活動偵測的行為
 */
export const VAD_CONFIG = {
  /**
   * 最小語音持續時間（毫秒）
   * 短於此時間的語音片段會被視為噪音並過濾掉
   * 
   * 建議值：
   * - 安靜環境：200ms
   * - 一般環境：250ms
   * - 嘈雜環境：300ms
   * 
   * 當前設定：800ms（確保 final chunk ≥ 0.8 秒，防止 Whisper 幻覺）
   */
  MIN_SPEECH_DURATION_MS: 800,

  /**
   * 靜音持續時間（毫秒）
   * 偵測到靜音超過此時間後，判定為句子結束
   * 
   * 建議值：
   * - 快速回應：500-600ms
   * - 平衡模式：650ms
   * - 完整句子：700-800ms
   * 
   * 當前設定：650ms（快速觸發，但確保語音夠長）
   */
  SILENCE_DURATION_MS: 650,

  /**
   * RMS 音量閾值
   * 高於此閾值才被視為有效語音
   * 
   * 建議值：
   * - 安靜環境：0.03-0.04
   * - 一般環境：0.055（預設）
   * - 嘈雜環境：0.08-0.10
   * 
   * 對應 dB 值：
   * - 0.03 ≈ -60dB
   * - 0.055 ≈ -55dB
   * - 0.08 ≈ -52dB
   */
  RMS_THRESHOLD: 0.055,
} as const;

// ==================== ASR (Automatic Speech Recognition) 參數 ====================

/**
 * Whisper API 配置
 * 控制 Whisper API 呼叫的參數
 */
export const WHISPER_CONFIG = {
  /**
   * Whisper 模型
   * 支援的模型：
   * - "whisper-1": 原版 Whisper 模型（API 入口）
   * - "gpt-4o-mini-transcribe": GPT-4o mini 轉錄模型（快速、低成本）
   * - "gpt-4o-transcribe": GPT-4o 轉錄模型（高品質、較慢）
   * - "gpt-4o-transcribe-diarize": GPT-4o 轉錄模型（含說話者辨識與時間資訊）
   * 
   * 當前設定：gpt-4o-mini-transcribe（預設）
   */
  MODEL: "gpt-4o-mini-transcribe" as const,

  /**
   * 可用的 ASR 模型列表
   * 用於前端 UI 選擇器
   */
  AVAILABLE_MODELS: [
    {
      value: "whisper-1",
      label: "Whisper-1",
      description: "原版 Whisper（API 入口）",
      icon: "🎙️",
    },
    {
      value: "gpt-4o-mini-transcribe",
      label: "GPT-4o Mini",
      description: "快速、低成本",
      icon: "⚡",
    },
    {
      value: "gpt-4o-transcribe",
      label: "GPT-4o",
      description: "高品質、較慢",
      icon: "🎯",
    },
    {
      value: "gpt-4o-transcribe-diarize",
      label: "GPT-4o Diarize",
      description: "含說話者辨識",
      icon: "👥",
    },
  ] as const,

  /**
   * 回應格式
   * - "json": 返回 JSON 格式（預設）
   * - "text": 返回純文字
   * - "srt": 返回 SRT 字幕格式
   * - "verbose_json": 返回詳細 JSON（包含時間戳、標點等）
   * - "vtt": 返回 WebVTT 字幕格式
   */
  RESPONSE_FORMAT: "json" as const,

  /**
   * API 端點
   */
  API_ENDPOINT: "https://api.openai.com/v1/audio/transcriptions" as const,
} as const;

/**
 * ASR 配置
 * 控制語音識別的行為
 */
export const ASR_CONFIG = {
  /**
   * Partial chunk 更新間隔（毫秒）
   * 即時字幕更新的頻率
   * 
   * 建議值：
   * - 快速更新：250-300ms
   * - 平衡模式：320ms
   * - 穩定更新：400-500ms
   * 
   * 當前設定：300ms（固定，不低於 280ms）
   */
  PARTIAL_CHUNK_INTERVAL_MS: 300,

  /**
   * Partial chunk 最小持續時間（毫秒）
   * 短於此時間的 chunk 會被過濾，避免 chunk 太碎導致語言誤判
   * 
   * 建議值：
   * - 快速回應：200ms
   * - 平衡模式：250ms
   * - 穩定識別：300ms
   * 
   * 當前設定：200ms（6 個 buffer ≈ 200-250ms）
   */
  PARTIAL_CHUNK_MIN_DURATION_MS: 200,

  /**
   * Whisper API 語言提示
   * 提升多語言識別準確度
   * 
   * 支援語言：
   * - Chinese (zh)
   * - Vietnamese (vi)
   * - English (en)
   * - Indonesian (id)
   */
  WHISPER_LANGUAGE_HINT: "Speaker likely speaks Chinese, Vietnamese, English, or Indonesian.",

  /**
   * Whisper API 強制語言
   * 設定為 undefined 則自動偵測語言（建議）
   * 
   * 建議值：
   * - 多語言模式：undefined（讓 Whisper 自動偵測）
   */
  WHISPER_FORCE_LANGUAGE: undefined as string | undefined,
} as const;

// ==================== 翻譯配置 ====================

/**
 * 翻譯配置
 * 控制翻譯行為
 */
export const TRANSLATION_CONFIG = {
  /**
   * 翻譯功能開關
   * 設定為 false 只做語音識別，不翻譯
   * 設定為 true 則同時執行語音識別和翻譯
   * 
   * 建議值：
   * - 測試階段：false（只測試 ASR）
   * - 正式使用：true（完整功能）
   */
  ENABLE_TRANSLATION: true,

  /**
   * LLM 翻譯模型
   * 用於執行翻譯任務的語言模型
   * 
   * 可用模型：
   * - "gpt-4o-mini": 最快速、最低成本
   * - "gpt-4.1-mini": 平衡速度和品質（推薦）
   * - "gpt-4.1": 高品質
   * - "gpt-4o": 最高品質、最慢
   * 
   * 當前設定：gpt-4.1-mini（最佳平衡）
   */
  LLM_MODEL: "gpt-4.1-mini" as string,

  /**
   * 可用的翻譯模型列表
   * 使用者可在設定頁面選擇
   */
  AVAILABLE_TRANSLATION_MODELS: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      description: "最快速、最低成本",
      icon: "⚡",
    },
    {
      id: "gpt-4.1-mini",
      name: "GPT-4.1 Mini",
      description: "平衡速度和品質（推薦）",
      icon: "⭐",
    },
    {
      id: "gpt-4.1",
      name: "GPT-4.1",
      description: "高品質",
      icon: "🎯",
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      description: "最高品質、最慢",
      icon: "💎",
    },
  ] as const,

  /**
   * 翻譯 Provider
   * 選擇使用的翻譯服務提供商
   * 
   * 可用選項：
   * - "openai": 使用 OpenAI GPT 模型（透過 Manus 內建 API）
   * - "google": Google Cloud Translation API（未實作）
   * - "azure": Azure Cognitive Services（未實作）
   * - "deepl": DeepL API（未實作）
   */
  TRANSLATION_PROVIDER: "openai" as string,

  /**
   * 預設目標語言
   * 台灣人說中文時，翻譯成此語言
   */
  DEFAULT_TARGET_LANGUAGE: "Vietnamese",

  /**
   * 支援的語言列表
   */
  SUPPORTED_LANGUAGES: [
    { code: "vi", name: "Vietnamese", label: "越南語" },
    { code: "id", name: "Indonesian", label: "印尼語" },
    { code: "tl", name: "Filipino", label: "菲律賓語" },
    { code: "en", name: "English", label: "英文" },
    { code: "it", name: "Italian", label: "義大利語" },
    { code: "ja", name: "Japanese", label: "日文" },
    { code: "ko", name: "Korean", label: "韓文" },
    { code: "th", name: "Thai", label: "泰文" },
  ] as const,
} as const;

// ==================== 音訊配置 ====================

/**
 * 音訊配置
 * 控制音訊錄製和處理
 */
export const AUDIO_CONFIG = {
  /**
   * 採樣率（Hz）
   * 16kHz 是 Whisper API 的建議值
   */
  SAMPLE_RATE: 16000,

  /**
   * 音訊格式
   * WebM 格式相容性好，且 Whisper API 原生支援
   */
  AUDIO_FORMAT: "audio/webm;codecs=opus",

  /**
   * 最小音訊長度（秒）
   * 短於此長度的音訊會被過濾，避免觸發 Whisper API 錯誤
   */
  MIN_AUDIO_LENGTH_SECONDS: 0.1,
} as const;

// ==================== 環境預設配置 ====================

/**
 * 不同環境的 VAD 預設配置
 */
export const VAD_PRESETS = {
  /**
   * 安靜室內環境（會議室、診間）
   */
  QUIET_INDOOR: {
    MIN_SPEECH_DURATION_MS: 200,
    SILENCE_DURATION_MS: 600,
    RMS_THRESHOLD: 0.03,
  },

  /**
   * 一般辦公室環境
   */
  OFFICE: {
    MIN_SPEECH_DURATION_MS: 250,
    SILENCE_DURATION_MS: 650,
    RMS_THRESHOLD: 0.055,
  },

  /**
   * 嘈雜環境（開車、戶外）
   */
  NOISY: {
    MIN_SPEECH_DURATION_MS: 300,
    SILENCE_DURATION_MS: 700,
    RMS_THRESHOLD: 0.08,
  },
} as const;

// ==================== 類型定義 ====================

// ==================== ASR 模式配置 ====================

/**
 * ASR 模式類型
 */
export type ASRMode = "normal" | "precise";

/**
 * ASR 模式配置
 * 根據模式動態調整 VAD、Chunk、Final、Whisper、Translation 參數
 */
export const ASR_MODE_CONFIG = {
  /**
   * Normal 模式（快速）
   * 
   * 用途：
   * - 普通對話
   * - 反應速度優先
   * - 護理站高流量狀態（人多、要快）
   * 
   * 預期效果：
   * - 0.6-1.2 秒出翻譯
   * - 準確率：85-93%
   */
  normal: {
    // VAD 參數
    minSpeechDurationMs: 300,  // v1.5.2: 降低從 400ms 到 300ms，減少短句丟棄
    silenceDurationMs: 600,    // 調整從 650ms 到 600ms
    rmsThreshold: 0.015, // 降低閖值以適應低音量麥克風 (from 0.055 to 0.015)
    
    // VAD Hysteresis 參數 (v1.5.4)
    vadStartThreshold: 0.045,  // 語音開始門檻（連續幀數高於此值才算開始）
    vadEndThreshold: 0.035,    // 語音結束門檻（連續幀數低於此值才算結束）
    vadStartFrames: 2,         // 開始連續幀數（需連續 N 幀高於 startThreshold）
    vadEndFrames: 8,           // 結束連續幀數（需連續 N 幀低於 endThreshold）
    
    // Chunk 參數
    partialChunkIntervalMs: 300,
    partialChunkMinBuffers: 6, // v1.5.2: 降低從 10 到 6（≈ 150ms，改善即時字幕延遲）
    partialChunkMinDurationMs: 150,  // v1.5.2: 降低從 240ms 到 150ms
    
    // Final 參數
    finalMinDurationMs: 300,  // v1.5.2: 降低從 800ms 到 300ms
    finalMaxDurationMs: 2000,  // v1.5.2: 降低從 4000ms 到 2000ms，符合 OpenAI API 限制
    discardBelowMs: 200,
    
    // Whisper 參數
    whisperPrompt: "Speaker likely speaks Chinese, Vietnamese, English, or Indonesian.",
    whisperForceLanguage: undefined, // 自動偵測語言
    whisperTemperature: 0,
    
    // Translation 參數
    translationModel: TRANSLATION_CONFIG.LLM_MODEL, // 使用統一配置的模型
  },
  
  /**
   * Precise 模式（高準確）
   * 
   * 用途：
   * - 醫療問診
   * - 溝通敏感資訊（用藥、疼痛、緊急狀況）
   * - 翻譯錯誤不能接受的場景
   * 
   * 預期效果：
   * - 1.0-2.0 秒出翻譯
   * - 準確率：95-99%
   */
  precise: {
    // VAD 參數
    minSpeechDurationMs: 400,  // 調整從 500ms 到 400ms
    silenceDurationMs: 600,    // 調整從 900ms 到 600ms
    rmsThreshold: 0.025, // 降低閖值以適應低音量麥克風 (from 0.1 to 0.025)
    
    // VAD Hysteresis 參數 (v1.5.4)
    vadStartThreshold: 0.050,  // 語音開始門檻（Precise 模式較高，減少誤觸發）
    vadEndThreshold: 0.040,    // 語音結束門檻
    vadStartFrames: 3,         // 開始連續幀數（Precise 模式較嚴格）
    vadEndFrames: 10,          // 結束連續幀數（Precise 模式較長，確保完整句子）
    
    // Chunk 參數
    partialChunkIntervalMs: 400,
    partialChunkMinBuffers: 8, // v1.5.2: 降低從 10 到 8（≈ 200ms，改善即時字幕延遲）
    partialChunkMinDurationMs: 200,  // v1.5.2: 降低從 240ms 到 200ms
    
    // Final 參數
    finalMinDurationMs: 400,   // v1.5.2: 降低從 800ms 到 400ms
    finalMaxDurationMs: 2000,  // v1.5.2: 降低從 4000ms 到 2000ms，符合 OpenAI API 限制
    discardBelowMs: 300,       // 調整從 400ms 到 300ms
    
    // Whisper 參數
    whisperPrompt: "User is speaking Chinese or Vietnamese. Prioritize Chinese detection.",
    whisperForceLanguage: undefined, // 自動偵測語言
    whisperTemperature: 0,
    
    // Translation 參數
    translationModel: TRANSLATION_CONFIG.LLM_MODEL, // 使用統一配置的模型
  },
} as const;

/**
 * 獲取指定模式的配置
 */
export function getASRModeConfig(mode: ASRMode) {
  return ASR_MODE_CONFIG[mode];
}

// ==================== 類型定義 ====================

// ==================== 模型允許清單 ====================

/**
 * 所有允許的 ASR 模型（一次性 Audio → Text 轉錄）
 * 用於驗證文件和程式碼中的模型引用
 * 
 * ASR (Automatic Speech Recognition) = 一次性轉錄模型
 * - 輸入：音訊檔案
 * - 輸出：文字轉錄結果
 * - API 範式：單次請求/回應
 */
export const ALLOWED_ASR_MODELS = [
  "whisper-1",                      // ASR: 原版 Whisper（API 入口）
  "gpt-4o-mini-transcribe",         // ASR: 快速、低成本
  "gpt-4o-transcribe",              // ASR: 高品質
  "gpt-4o-transcribe-diarize",      // ASR: 含說話者辨識
] as const;

/**
 * Realtime Audio 模型（事件流、session 為核心）
 * 用於驗證文件和程式碼中的 Realtime Audio Agent 引用
 * 
 * Realtime Audio Agent = 雙向即時音訊互動
 * - 輸入：WebSocket 事件流
 * - 輸出：即時音訊/文字回應
 * - API 範式：session-based、事件驅動
 * 
 * 注意：Realtime Audio 模型與 ASR 模型是完全不同的 API 範式，
 * 不應混在 ALLOWED_ASR_MODELS 中，以避免語義污染。
 */
export const REALTIME_AUDIO_MODELS = [
  "gpt-4o-realtime-preview",        // Realtime: 即時音訊處理（非 ASR）
] as const;

/**
 * Legacy 翻譯模型（已棄用，僅供相容性）
 * 不建議在新專案中使用
 */
export const LEGACY_TRANSLATION_MODELS = [
  "gpt-3.5-turbo",          // 使用 gpt-4.1-mini 替代
  "gpt-3.5-turbo-instruct", // 使用 gpt-4.1-mini 替代
] as const;

/**
 * 所有允許的翻譯模型
 * 用於驗證文件和程式碼中的模型引用
 * 
 * 分類說明：
 * - gpt-4.1-mini: 預設翻譯模型（平衡速度和品質）
 * - gpt-4o-mini: 可選翻譯模型（最快速、最低成本）
 * - gpt-4.1: 高品質翻譯
 * - gpt-4o: 最高品質翻譯
 */
export const ALLOWED_TRANSLATION_MODELS = [
  "gpt-4o-mini",    // Translation option: 最快速、最低成本
  "gpt-4.1-mini",   // Translation default: 平衡速度和品質（推薦）
  "gpt-4.1",        // Translation: 高品質
  "gpt-4o",         // Translation: 最高品質、最慢
] as const;

/**
 * 所有允許的模型（ASR + Realtime Audio + 翻譯 + Legacy）
 * 用於統一驗證（包含 legacy 模型以支援相容性檢查）
 */
export const ALLOWED_MODELS = [
  ...ALLOWED_ASR_MODELS,
  ...REALTIME_AUDIO_MODELS,
  ...ALLOWED_TRANSLATION_MODELS,
  ...LEGACY_TRANSLATION_MODELS,
] as const;

export type VADConfig = typeof VAD_CONFIG;
export type ASRConfig = typeof ASR_CONFIG;
export type TranslationConfig = typeof TRANSLATION_CONFIG;
export type AudioConfig = typeof AUDIO_CONFIG;
export type VADPreset = keyof typeof VAD_PRESETS;
export type ASRModeConfig = typeof ASR_MODE_CONFIG[ASRMode];
export type AllowedASRModel = typeof ALLOWED_ASR_MODELS[number];
export type RealtimeAudioModel = typeof REALTIME_AUDIO_MODELS[number];
export type AllowedTranslationModel = typeof ALLOWED_TRANSLATION_MODELS[number];
export type AllowedModel = typeof ALLOWED_MODELS[number];
