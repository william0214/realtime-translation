import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Audio processing endpoints
  audio: router({
    // Process WebM audio chunk → Whisper transcription
    chunk: publicProcedure
      .input(
        z.object({
          audioBase64: z.string(),
          filename: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { transcribeAudio } = await import("./translationService");

        try {
          const audioBuffer = Buffer.from(input.audioBase64, "base64");
          const filename = input.filename || `audio-${Date.now()}.webm`;

          // Step 1: Whisper transcription (WebM direct)
          const { text } = await transcribeAudio(audioBuffer, filename);

          if (!text || text.trim() === "") {
            return {
              success: false,
              error: "No speech detected",
            };
          }

          return {
            success: true,
            text,
          };
        } catch (error: any) {
          console.error("[audio.chunk] Error:", error);
          return {
            success: false,
            error: error.message || "Transcription failed",
          };
        }
      }),
  }),

  // Language detection endpoint
  language: router({
    // Stage 2: LLM-based language identification (99%+ accuracy)
    identify: publicProcedure
      .input(
        z.object({
          text: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { identifyLanguage } = await import("./translationService");

        try {
          const language = await identifyLanguage(input.text);

          return {
            success: true,
            language,
          };
        } catch (error: any) {
          console.error("[language.identify] Error:", error);
          return {
            success: false,
            error: error.message || "Language identification failed",
            language: "zh", // Fallback
          };
        }
      }),
  }),

  // Translation endpoint
  translate: router({
    // Translate text from source language to target language
    text: publicProcedure
      .input(
        z.object({
          text: z.string(),
          sourceLang: z.string(),
          targetLang: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { translateText } = await import("./translationService");

        try {
          const translatedText = await translateText(
            input.text,
            input.sourceLang,
            input.targetLang
          );

          return {
            success: true,
            translatedText,
          };
        } catch (error: any) {
          console.error("[translate.text] Error:", error);
          return {
            success: false,
            error: error.message || "Translation failed",
          };
        }
      }),
  }),

  // TTS endpoint
  tts: router({
    // Generate speech from text
    generate: publicProcedure
      .input(
        z.object({
          text: z.string(),
          targetLang: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { generateSpeech } = await import("./translationService");

        try {
          const audioBuffer = await generateSpeech(input.text, input.targetLang);
          const audioBase64 = audioBuffer.toString("base64");

          return {
            success: true,
            audioBase64,
          };
        } catch (error: any) {
          console.error("[tts.generate] Error:", error);
          return {
            success: false,
            error: error.message || "TTS generation failed",
          };
        }
      }),
  }),

  // Legacy endpoint (for backward compatibility)
  translation: router({
    // Auto translate: ASR + Language Detection + Translation (all-in-one)
    autoTranslate: publicProcedure
      .input(
        z.object({
          audioBase64: z.string(),
          filename: z.string().optional(),
          preferredTargetLang: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { transcribeAudio, identifyLanguage, determineDirection, translateText } =
          await import("./translationService");

        try {
          const audioBuffer = Buffer.from(input.audioBase64, "base64");
          const filename = input.filename || `audio-${Date.now()}.webm`;

          // Step 1: Whisper transcription
          const { text: sourceText } = await transcribeAudio(audioBuffer, filename);

          if (!sourceText || sourceText.trim() === "") {
            return {
              success: false,
              error: "No speech detected",
            };
          }

          // Step 2: LLM language identification
          const language = await identifyLanguage(sourceText);

          // Step 3: Determine direction
          const { direction, sourceLang, targetLang } = determineDirection(
            language,
            input.preferredTargetLang
          );

          // Step 4: Translate
          const translatedText = await translateText(sourceText, sourceLang, targetLang);

          return {
            success: true,
            direction,
            sourceLang,
            targetLang,
            sourceText,
            translatedText,
          };
        } catch (error: any) {
          console.error("[autoTranslate] Error:", error);
          return {
            success: false,
            error: error.message || "Translation failed",
          };
        }
      }),

    // Get recent translations
    getRecent: publicProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        const { getRecentTranslations } = await import("./db");
        return getRecentTranslations(input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
