import FormData from "form-data";
import { invokeLLM } from "./_core/llm";

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

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename,
    contentType: "audio/webm",
  });
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return {
    text: result.text || "",
    language: result.language || "unknown",
  };
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

  const systemPrompt = `你是一個專業的醫療場景翻譯助手。請將以下${sourceLanguageName}文字忠實翻譯成${targetLanguageName}，不要自行加入或刪減內容。保持醫療術語的準確性。`;

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
 * Generate speech from text using OpenAI TTS API
 */
export async function generateSpeech(text: string, language: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Map language to voice
  const voiceMap: Record<string, string> = {
    zh: "alloy",
    "zh-tw": "alloy",
    "zh-cn": "alloy",
    vi: "nova",
    id: "nova",
    tl: "nova",
    fil: "nova",
    en: "echo",
  };

  const voice = voiceMap[language] || "alloy";

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
