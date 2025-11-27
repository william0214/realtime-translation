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
   * 當前設定：500ms（確保 final chunk ≥ 0.8-1.2 秒）
   */
  MIN_SPEECH_DURATION_MS: 500,

  /**
   * 靜音持續時間（毫秒）
   * 偵測到靜音超過此時間後，判定為句子結束
   * 
   * 建議值：
   * - 快速回應：500-600ms
   * - 平衡模式：650ms
   * - 完整句子：700-800ms
   * 
   * 當前設定：800ms（確保收集完整句子）
   */
  SILENCE_DURATION_MS: 800,

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
   * 設定為 "zh" 可提升中文識別準確度
   * 設定為 undefined 則自動偵測語言
   * 
   * 建議值：
   * - 單人中文模式：zh
   * - 多語言模式：undefined
   */
  WHISPER_FORCE_LANGUAGE: "zh" as string | undefined,
} as const;

// ==================== 翻譯配置 ====================

/**
 * 翻譯配置
 * 控制翻譯行為
 */
export const TRANSLATION_CONFIG = {
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

export type VADConfig = typeof VAD_CONFIG;
export type ASRConfig = typeof ASR_CONFIG;
export type TranslationConfig = typeof TRANSLATION_CONFIG;
export type AudioConfig = typeof AUDIO_CONFIG;
export type VADPreset = keyof typeof VAD_PRESETS;
