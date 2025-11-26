/**
 * Go Backend API Service
 * 
 * This service handles communication with the Go backend server.
 * Currently uses REST API, can be extended to WebSocket for streaming.
 */

const GO_BACKEND_URL = import.meta.env.VITE_GO_BACKEND_URL || "http://localhost:8080";

export type GoTranslationRequest = {
  audioBase64: string;
  filename?: string;
  preferredTargetLang?: string;
};

export type GoTranslationResponse = {
  success: boolean;
  sourceText?: string;
  translatedText?: string;
  sourceLang?: string;
  targetLang?: string;
  direction?: string;
  error?: string;
};

/**
 * Call Go backend REST API for translation
 */
export async function callGoTranslation(request: GoTranslationRequest): Promise<GoTranslationResponse> {
  try {
    const response = await fetch(`${GO_BACKEND_URL}/api/v1/asr/segment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_base64: request.audioBase64,
        target_language: request.preferredTargetLang || "vi",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Map Go response to our format
    return {
      success: true,
      sourceText: data.transcript || "",
      translatedText: data.translation || "",
      sourceLang: data.detected_language || "unknown",
      targetLang: request.preferredTargetLang || "vi",
      direction: data.direction || "unknown",
    };
  } catch (error: any) {
    console.error("[Go Backend] Error:", error);
    return {
      success: false,
      error: error.message || "Translation failed",
    };
  }
}
