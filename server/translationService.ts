import { invokeLLM } from "./_core/llm";
import axios from "axios";
import FormData from "form-data";

/**
 * Language role mapping
 */
const NURSE_LANGUAGES = ["zh", "zh-tw", "zh-cn"];
const PATIENT_LANGUAGES = ["vi", "id", "tl", "fil", "en"];

/**
 * Determine translation direction based on detected language
 */
export function determineDirection(language: string): {
  direction: "nurse_to_patient" | "patient_to_nurse";
  sourceLang: string;
  targetLang: string;
} {
  const normalizedLang = language.toLowerCase();

  if (NURSE_LANGUAGES.includes(normalizedLang)) {
    return {
      direction: "nurse_to_patient",
      sourceLang: normalizedLang,
      targetLang: "vi", // Default to Vietnamese for patient
    };
  }

  // Patient or fallback
  return {
    direction: "patient_to_nurse",
    sourceLang: normalizedLang,
    targetLang: "zh", // Default to Chinese for nurse
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
  const form = new FormData();
  form.append("file", audioBuffer, {
    filename,
    contentType: "audio/webm",
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