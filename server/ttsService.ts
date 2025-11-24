import axios from "axios";

/**
 * Generate speech from text using OpenAI TTS API
 * Model: tts-1 (optimized for speed)
 * Voice: alloy (neutral, clear)
 */
export async function generateSpeech(
  text: string,
  language: string
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Select voice based on language
  const voice = selectVoice(language);

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "tts-1", // Optimized for speed (120-350ms)
        input: text,
        voice,
        response_format: "mp3",
        speed: 1.0,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    console.log(`[TTS] Generated speech for "${text.substring(0, 50)}..." (${response.data.byteLength} bytes)`);
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

/**
 * Select appropriate voice based on language
 */
function selectVoice(language: string): string {
  const normalizedLang = language.toLowerCase();

  // Voice selection for better pronunciation
  const voiceMap: Record<string, string> = {
    zh: "alloy", // Chinese
    vi: "nova", // Vietnamese
    id: "nova", // Indonesian
    tl: "nova", // Tagalog
    fil: "nova", // Filipino
    en: "alloy", // English
    it: "alloy", // Italian
    ja: "alloy", // Japanese
    ko: "alloy", // Korean
    th: "nova", // Thai
  };

  return voiceMap[normalizedLang] || "alloy";
}
