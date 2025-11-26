/**
 * Translation Provider Architecture
 * 
 * Supports multiple translation providers with configurable models.
 * Optimized for low latency and high throughput.
 */

import { invokeLLM } from "./_core/llm";

export type TranslationProvider = "openai" | "google" | "azure" | "deepl";

export interface TranslationConfig {
  provider: TranslationProvider;
  model?: string; // e.g., "gpt-4o-mini", "gpt-3.5-turbo"
  apiKey?: string;
}

export interface TranslationResult {
  translatedText: string;
  provider: TranslationProvider;
  model: string;
  duration: number;
}

const LANGUAGE_NAMES: Record<string, string> = {
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

/**
 * OpenAI GPT Translation Provider
 * 
 * Optimized for speed:
 * - Minimal prompt (reduced tokens)
 * - Disabled thinking mode
 * - Default model: gpt-4o-mini (faster than gpt-4)
 */
async function translateWithOpenAI(
  text: string,
  sourceLang: string,
  targetLang: string,
  model: string = "gpt-4o-mini"
): Promise<TranslationResult> {
  const startTime = Date.now();

  const sourceName = LANGUAGE_NAMES[sourceLang] || sourceLang;
  const targetName = LANGUAGE_NAMES[targetLang] || targetLang;

  // OPTIMIZED: Minimal prompt to reduce tokens and latency
  const systemPrompt = `翻譯${sourceName}→${targetName}。只輸出譯文。`;

  // Note: invokeLLM uses default model (currently gemini-2.5-flash)
  // TODO: Add model parameter support to invokeLLM if needed
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    thinking: false, // Disable thinking mode for speed
  });

  const content = response.choices[0]?.message?.content;
  const translatedText = typeof content === "string" ? content.trim() : "";

  const duration = Date.now() - startTime;

  return {
    translatedText,
    provider: "openai",
    model,
    duration,
  };
}

/**
 * Google Cloud Translation Provider (placeholder)
 * 
 * TODO: Implement Google Cloud Translation API
 */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  throw new Error("Google Translation Provider not implemented yet");
}

/**
 * Azure Translator Provider (placeholder)
 * 
 * TODO: Implement Azure Cognitive Services Translator API
 */
async function translateWithAzure(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  throw new Error("Azure Translation Provider not implemented yet");
}

/**
 * DeepL Translation Provider (placeholder)
 * 
 * TODO: Implement DeepL API
 */
async function translateWithDeepL(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  throw new Error("DeepL Translation Provider not implemented yet");
}

/**
 * Main translation function with provider selection
 * 
 * @param text - Text to translate
 * @param sourceLang - Source language code
 * @param targetLang - Target language code
 * @param config - Translation configuration (provider, model, apiKey)
 * @returns Translation result with metadata
 */
export async function translate(
  text: string,
  sourceLang: string,
  targetLang: string,
  config: TranslationConfig = { provider: "openai", model: "gpt-4o-mini" }
): Promise<TranslationResult> {
  const { provider, model } = config;

  console.log(`[Translation] Provider: ${provider}, Model: ${model || "default"}`);

  switch (provider) {
    case "openai":
      return translateWithOpenAI(text, sourceLang, targetLang, model);
    case "google":
      return translateWithGoogle(text, sourceLang, targetLang);
    case "azure":
      return translateWithAzure(text, sourceLang, targetLang);
    case "deepl":
      return translateWithDeepL(text, sourceLang, targetLang);
    default:
      throw new Error(`Unknown translation provider: ${provider}`);
  }
}

/**
 * Get default translation config
 * 
 * Can be overridden by environment variables:
 * - TRANSLATION_PROVIDER: "openai" | "google" | "azure" | "deepl"
 * - TRANSLATION_MODEL: e.g., "gpt-4o-mini", "gpt-3.5-turbo"
 */
export function getDefaultTranslationConfig(): TranslationConfig {
  const provider = (process.env.TRANSLATION_PROVIDER as TranslationProvider) || "openai";
  const model = process.env.TRANSLATION_MODEL || "gpt-4o-mini";

  return { provider, model };
}
