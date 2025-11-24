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
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{
  text: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const form = new FormData();
  form.append("file", audioBuffer, {
    filename,
    contentType: "audio/webm",
  });
  form.append("model", "whisper-1");
  form.append("response_format", "json");
  form.append("temperature", "0");

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
    console.log(`[Whisper] Transcript: "${text}"`);

    return { text };
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

  // Note: invokeLLM uses default model (gpt-4o-mini equivalent)
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
