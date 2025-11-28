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
  transcriptOnly?: boolean; // If true, only do transcription, no translation
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
    console.log("[Go Backend] Sending request to:", `${GO_BACKEND_URL}/api/v1/asr/segment`);
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
      const errorText = await response.text();
      console.error("[Go Backend] HTTP error:", response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log("[Go Backend] Response:", data);

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
    const errorMessage = error.message || error.toString() || "Translation failed: Unknown error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
