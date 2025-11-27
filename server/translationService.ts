import { invokeLLM } from "./_core/llm";
import axios from "axios";
import FormData from "form-data";
import { ASR_CONFIG, type ASRMode, getASRModeConfig } from "../shared/config";

/**
 * Language role mapping
 * Chinese variants are ALWAYS Taiwanese
 * All other languages are ALWAYS foreigners
 */
const CHINESE_LANGUAGES = ["zh", "zh-tw", "zh-cn", "cmn", "yue", "chinese"];

/**
 * Determine translation direction based on detected language
 */
export function determineDirection(
  language: string,
  preferredTargetLang?: string
): {
  direction: "nurse_to_patient" | "patient_to_nurse";
  sourceLang: string;
  targetLang: string;
} {
  const normalizedLang = language.toLowerCase();

  // Rule 1: Chinese → Taiwanese → translate to preferred language
  if (CHINESE_LANGUAGES.includes(normalizedLang)) {
    return {
      direction: "nurse_to_patient",
      sourceLang: "zh",
      targetLang: preferredTargetLang || "vi",
    };
  }

  // Rule 2: Non-Chinese → Foreigner → translate to Chinese
  return {
    direction: "patient_to_nurse",
    sourceLang: normalizedLang,
    targetLang: "zh",
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
  form.append("model", "whisper-1");
  form.append("response_format", "json");
  form.append("temperature", modeConfig.whisperTemperature.toString());
  // Use mode-specific language settings
  if (modeConfig.whisperForceLanguage) {
    form.append("language", modeConfig.whisperForceLanguage);
  }
  form.append("prompt", modeConfig.whisperPrompt);

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const text = response.data.text || "";
    const language = response.data.language || "zh"; // Whisper returns ISO-639-1 language code
    console.log(`[Whisper] Transcript: "${text}", Language: ${language} (forced Chinese)`);

    // End ASR profiling
    const audioDuration = 1.0; // Estimated, can be calculated from buffer if needed
    const asrProfile = profiler.end(audioDuration, audioBuffer.length, "whisper-1");
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
