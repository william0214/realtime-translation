import { invokeLLM } from "./_core/llm";
import axios from "axios";
import FormData from "form-data";

/**
 * Language role mapping
 * Chinese variants are ALWAYS Taiwanese (nurse)
 * All other languages are ALWAYS foreigners (patient)
 */
const CHINESE_LANGUAGES = ["zh", "zh-tw", "zh-cn", "cmn", "yue"];

/**
 * Determine translation direction based on detected language
 * Logic:
 * 1. If detected language is Chinese → Taiwanese → translate to user's preferred language
 * 2. If detected language is NOT Chinese → Foreigner → translate to Chinese
 * @param language - Detected language code
 * @param preferredTargetLang - User's preferred target language (optional)
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
      sourceLang: normalizedLang,
      targetLang: preferredTargetLang || "vi", // Use user preference or default to Vietnamese
    };
  }

  // Rule 2: Non-Chinese → Foreigner → translate to Chinese
  return {
    direction: "patient_to_nurse",
    sourceLang: normalizedLang,
    targetLang: "zh", // Always translate to Chinese
  };
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{
  text: string;
  language: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Use form-data with Buffer (most stable way)
  // Support both WebM and WAV formats
  const contentType = filename.endsWith(".wav") ? "audio/wav" : "audio/webm";
  const form = new FormData();
  form.append("file", audioBuffer, {
    filename,
    contentType,
  });
  form.append("model", "whisper-1");

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

    return {
      text: response.data.text || "",
      language: response.data.language || "unknown",
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
 * Translate text using OpenAI GPT
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const languageNames: Record<string, string> = {
    zh: "中文",
    "zh-tw": "繁體中文",
    "zh-cn": "簡體中文",
    vi: "越南語",
    id: "印尼語",
    tl: "他加祿語",
    fil: "菲律賓語",
    en: "英文",
  };

  const sourceLanguageName = languageNames[sourceLang] || sourceLang;
  const targetLanguageName = languageNames[targetLang] || targetLang;

  const systemPrompt = `你是一個專業的醫療翻譯助手。請將${sourceLanguageName}直接翻譯成${targetLanguageName}。

重要規則：
1. 只回傳翻譯結果，不要任何解釋、說明或額外文字
2. 不要加上「原文：」、「翻譯：」、「備註：」等標籤
3. 不要使用粗體、星號或其他格式符號
4. 保持醫療術語準確性
5. 如果是問候語或簡短對話，直接翻譯即可

範例：
輸入："Hello"
正確輸出："你好"
錯誤輸出："好的，這是翻譯：你好" ❌`;

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

// TTS功能已移除，不需要語音播放