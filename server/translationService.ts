import { invokeLLM } from "./_core/llm";
import axios from "axios";
import FormData from "form-data";
import { ASR_CONFIG, WHISPER_CONFIG, type ASRMode, getASRModeConfig } from "../shared/config";

/**
 * Language role mapping
 * Chinese variants are ALWAYS Taiwanese
 * All other languages are ALWAYS foreigners
 */
const CHINESE_LANGUAGES = ["zh", "zh-tw", "zh-cn", "cmn", "yue", "chinese"];

/**
 * Common Whisper hallucination patterns
 * These are phrases that Whisper often generates when there's no clear speech
 * Usually from YouTube/video training data
 */
const WHISPER_HALLUCINATION_PATTERNS = [
  // Chinese YouTube subscription prompts
  "请不吝点赞",
  "订阅",
  "转发",
  "打赏支持",
  "明镜与点点",
  "感谢观看",
  "感谢收看",
  "请订阅",
  "请点赞",
  "关注我",
  "关注我们",
  // English YouTube prompts
  "subscribe",
  "like and subscribe",
  "thanks for watching",
  "don't forget to",
  // Vietnamese YouTube prompts
  "đăng ký",
  "like và đăng ký",
  // Common filler/noise patterns
  "...",
  "www.",
  "http",
  "FEMA",
  "For more information",
];

/**
 * Check if text is a Whisper hallucination
 * Returns true if the text matches common hallucination patterns
 */
function isWhisperHallucination(text: string): boolean {
  if (!text || text.trim().length === 0) return true;
  
  const normalizedText = text.toLowerCase().trim();
  
  // Check for exact or partial matches with hallucination patterns
  for (const pattern of WHISPER_HALLUCINATION_PATTERNS) {
    if (normalizedText.includes(pattern.toLowerCase())) {
      console.log(`[Whisper] ⚠️ Detected hallucination pattern: "${pattern}" in "${text}"`);
      return true;
    }
  }
  
  // Check for repetitive patterns (e.g., "谢谢,谢谢,谢谢")
  const words = normalizedText.split(/[,，\s]+/).filter(w => w.length > 0);
  if (words.length >= 3) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size === 1) {
      console.log(`[Whisper] ⚠️ Detected repetitive hallucination: "${text}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * Check if text contains primarily Chinese characters
 * Used as a fallback when Whisper returns "unknown"
 */
function containsChineseCharacters(text: string): boolean {
  if (!text) return false;
  // Match CJK Unified Ideographs (Chinese characters)
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
  const chineseMatches = text.match(chineseRegex) || [];
  // If more than 30% of the text is Chinese characters, consider it Chinese
  const ratio = chineseMatches.length / text.replace(/\s/g, '').length;
  return ratio > 0.3;
}

/**
 * Check if text contains Vietnamese diacritics
 * Vietnamese has unique diacritical marks that distinguish it from other languages
 */
function containsVietnameseDiacritics(text: string): boolean {
  if (!text) return false;
  // Vietnamese-specific diacritical marks
  const vietnameseRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
  return vietnameseRegex.test(text);
}

/**
 * Check if text contains Arabic/Persian script
 * These are clearly non-Chinese and should be treated as foreign language
 */
function containsArabicScript(text: string): boolean {
  if (!text) return false;
  // Arabic script range (includes Persian/Farsi)
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

/**
 * Check if text contains Japanese Hiragana/Katakana
 */
function containsJapaneseKana(text: string): boolean {
  if (!text) return false;
  // Hiragana and Katakana ranges
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
  return japaneseRegex.test(text);
}

/**
 * Check if text contains Korean Hangul
 */
function containsKoreanHangul(text: string): boolean {
  if (!text) return false;
  // Hangul syllables and Jamo
  const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
  return koreanRegex.test(text);
}

/**
 * Check if text contains Thai script
 */
function containsThaiScript(text: string): boolean {
  if (!text) return false;
  const thaiRegex = /[\u0E00-\u0E7F]/;
  return thaiRegex.test(text);
}

/**
 * Determine translation direction based on detected language AND text content
 * 
 * IMPORTANT: Text content analysis takes PRIORITY over Whisper language detection
 * because Whisper often misidentifies Vietnamese as Chinese.
 * 
 * Priority:
 * 1. ALWAYS check text content first (Vietnamese diacritics are very distinctive)
 * 2. If no Vietnamese diacritics, trust Whisper's language detection
 * 3. Default to Chinese (Taiwan user assumption)
 */
export function determineDirection(
  language: string,
  preferredTargetLang?: string,
  sourceText?: string
): {
  direction: "nurse_to_patient" | "patient_to_nurse";
  sourceLang: string;
  targetLang: string;
} {
  const normalizedLang = language.toLowerCase();

  // Rule 1: ALWAYS check for Vietnamese diacritics FIRST (highest priority)
  // Vietnamese has very distinctive diacritical marks that are unmistakable
  // This overrides Whisper's language detection because Whisper often misidentifies Vietnamese as Chinese
  if (sourceText && containsVietnameseDiacritics(sourceText)) {
    console.log(`[determineDirection] ✅ Detected Vietnamese from text content (overriding Whisper: ${normalizedLang}): "${sourceText.substring(0, 50)}..."`);
    return {
      direction: "patient_to_nurse",
      sourceLang: "vi",
      targetLang: "zh",
    };
  }

  // Rule 2: If Whisper detected a specific non-Chinese language, trust it
  if (normalizedLang !== "unknown" && !CHINESE_LANGUAGES.includes(normalizedLang)) {
    console.log(`[determineDirection] Using Whisper detected language: ${normalizedLang}`);
    return {
      direction: "patient_to_nurse",
      sourceLang: normalizedLang,
      targetLang: "zh",
    };
  }

  // Rule 3: If Whisper detected Chinese OR unknown, check for Chinese characters
  if (sourceText && containsChineseCharacters(sourceText)) {
    console.log(`[determineDirection] Detected Chinese from text content: "${sourceText.substring(0, 50)}..."`);
    return {
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: preferredTargetLang || "vi",
    };
  }

  // Rule 4: If Whisper detected Chinese, trust it
  if (CHINESE_LANGUAGES.includes(normalizedLang)) {
    console.log(`[determineDirection] Using Whisper detected Chinese: ${normalizedLang}`);
    return {
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: preferredTargetLang || "vi",
    };
  }

  // Rule 5: Default to Chinese (Taiwan user assumption)
  console.log(`[determineDirection] Defaulting to Chinese (no clear indicators)`);
  return {
    direction: "nurse_to_patient",
    sourceLang: "zh",
    targetLang: preferredTargetLang || "vi",
  };
}

/**
 * Stage 2: LLM-based Language Detection (99%+ accuracy)
 * This is the FINAL language detection result
 */
export async function identifyLanguage(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return "zh"; // Default to Chinese
  }

  const systemPrompt = `請判斷以下句子的語言，只回傳語言代碼（zh, en, vi, id, tl, it, ja, ko, th）。不要任何解釋。`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `「${text}」` },
      ],
      thinking: false, // Disable thinking mode
    });

    const content = response.choices[0]?.message?.content;
    const detectedLang = typeof content === "string" ? content.trim().toLowerCase() : "zh";

    // Validate the detected language code
    const validLangs = ["zh", "vi", "en", "id", "tl", "it", "ja", "ko", "th", "fil"];
    return validLangs.includes(detectedLang) ? detectedLang : "zh";
  } catch (error) {
    console.error("[LLM Language Detection] Error:", error);
    return "zh"; // Fallback to Chinese
  }
}

/**
 * Transcribe audio using OpenAI Whisper API (OPTIMIZED FOR SPEED)
 * - Direct WebM support (no conversion needed)
 * - temperature=0 for consistency
 * - response_format=json for faster processing
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  asrMode?: ASRMode
): Promise<{
  text: string;
  language?: string;
  asrProfile?: any;
}> {
  // Get ASR mode config (default to normal if not provided)
  const modeConfig = asrMode ? getASRModeConfig(asrMode) : getASRModeConfig("normal");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Start ASR profiling
  const { ASRProfiler } = await import("./profiler/asrProfiler");
  const profiler = new ASRProfiler();
  profiler.start();

  // Use ASR mode config for Whisper parameters
  const form = new FormData();
  form.append("file", audioBuffer, {
    filename,
    contentType: "audio/webm",
  });
  form.append("model", WHISPER_CONFIG.MODEL);
  form.append("response_format", WHISPER_CONFIG.RESPONSE_FORMAT);
  form.append("temperature", modeConfig.whisperTemperature.toString());
  // Use mode-specific language settings
  if (modeConfig.whisperForceLanguage) {
    form.append("language", modeConfig.whisperForceLanguage);
  }
  form.append("prompt", modeConfig.whisperPrompt);

  try {
    const response = await axios.post(
      WHISPER_CONFIG.API_ENDPOINT,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    let text = response.data.text || "";
    const language = response.data.language || "unknown"; // Whisper returns ISO-639-1 language code
    console.log(`[Whisper] Transcript: "${text}", Language: ${language} (auto-detected)`);

    // Filter out Whisper hallucinations
    if (isWhisperHallucination(text)) {
      console.log(`[Whisper] ❌ Filtered hallucination, returning empty text`);
      text = ""; // Return empty text to trigger "No speech detected" handling
    }

    // End ASR profiling
    const audioDuration = 1.0; // Estimated, can be calculated from buffer if needed
    const asrProfile = profiler.end(audioDuration, audioBuffer.length, WHISPER_CONFIG.MODEL);
    console.log(`[ASR Profiler] Duration: ${asrProfile.duration.toFixed(0)}ms`);

    return { text, language, asrProfile };
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Whisper API error: ${error.response.status} ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

/**
 * Translate text using configurable Provider architecture
 * 
 * OPTIMIZED FOR SPEED:
 * - Minimal prompt (reduced tokens)
 * - Default model: gpt-4o-mini (faster)
 * - Disabled thinking mode
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  asrMode?: ASRMode
): Promise<{ translatedText: string; translationProfile?: any }> {
  // Get ASR mode config for translation model selection
  const modeConfig = asrMode ? getASRModeConfig(asrMode) : getASRModeConfig("normal");
  // Start Translation profiling
  const { TranslationProfiler } = await import("./profiler/translationProfiler");
  const profiler = new TranslationProfiler();
  profiler.start();

  // Use new Provider architecture with mode-specific model
  const { translate, getDefaultTranslationConfig } = await import("./translationProviders");
  const config = getDefaultTranslationConfig();
  // Override model based on ASR mode
  config.model = modeConfig.translationModel;
  
  const result = await translate(text, sourceLang, targetLang, config);

  // End Translation profiling
  const translationProfile = profiler.end(text, sourceLang, targetLang, result.model);
  console.log(`[Translation Profiler] Provider: ${result.provider}, Model: ${result.model}, Duration: ${result.duration}ms`);

  return { translatedText: result.translatedText, translationProfile };
}

/**
 * Generate speech using OpenAI TTS API
 */
export async function generateSpeech(text: string, targetLang: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Select voice based on target language
  const voiceMap: Record<string, string> = {
    zh: "alloy",
    en: "echo",
    vi: "nova",
    id: "shimmer",
    tl: "fable",
    fil: "fable",
    it: "onyx",
    ja: "alloy",
    ko: "alloy",
    th: "nova",
  };

  const voice = voiceMap[targetLang] || "alloy";

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "tts-1",
        input: text,
        voice,
        response_format: "mp3",
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data);
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `TTS API error: ${error.response.status} ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}
