import { invokeLLM } from "./_core/llm";
import axios from "axios";
import FormData from "form-data";

/**
 * Language role mapping
 * Chinese variants are ALWAYS Taiwanese
 * All other languages are ALWAYS foreigners
 */
const CHINESE_LANGUAGES = ["zh", "zh-tw", "zh-cn", "cmn", "yue", "chinese"];

/**
 * Determine translation direction based on detected language
 * Logic:
 * 1. If detected language is Chinese → Taiwanese → translate to user's preferred language
 * 2. If detected language is NOT Chinese → Foreigner → translate to Chinese
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
 * Transcribe audio using OpenAI Whisper API (OPTIMIZED - Direct WebM)
 * - No WAV conversion needed (faster!)
 * - Uses language hint (zh) to improve Chinese detection
 * - Supports WebM format directly
 */
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{
  text: string;
  language: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Detect content type from filename
  const contentType = filename.endsWith(".wav") 
    ? "audio/wav" 
    : filename.endsWith(".mp3")
    ? "audio/mp3"
    : "audio/webm";

  const form = new FormData();
  form.append("file", audioBuffer, {
    filename,
    contentType,
  });
  form.append("model", "whisper-1");
  // Language hint improves Chinese detection rate
  form.append("language", "zh");

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

    const detectedLanguage = response.data.language || "zh";
    console.log(`[Whisper] Text: "${response.data.text}", Language: ${detectedLanguage}`);

    return {
      text: response.data.text || "",
      language: detectedLanguage,
    };
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
 * Translate text using OpenAI GPT (OPTIMIZED FOR SPEED)
 * - Simple and direct translation
 * - No unnecessary prompts
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const languageNames: Record<string, string> = {
    zh: "中文",
    vi: "越南語",
    id: "印尼語",
    tl: "菲律賓語",
    fil: "菲律賓語",
    en: "英文",
    it: "義大利語",
    ja: "日文",
    ko: "韓文",
    th: "泰文",
  };

  const sourceLanguageName = languageNames[sourceLang] || sourceLang;
  const targetLanguageName = languageNames[targetLang] || targetLang;

  const systemPrompt = `你是專業翻譯。將${sourceLanguageName}翻譯成${targetLanguageName}。只回傳翻譯結果，不要解釋。`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
  });

  const content = response.choices[0]?.message?.content;
  const translatedText = typeof content === "string" ? content : "";
  return translatedText.trim();
}
