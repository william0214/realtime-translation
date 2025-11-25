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

  // Translation endpoint (handles full workflow)
  translation: router({
    // Auto-translate: Whisper → LLM language detection → translate
    autoTranslate: publicProcedure
      .input(
        z.object({
          audioBase64: z.string(),
          filename: z.string().optional(),
          preferredTargetLang: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { transcribeAudio, identifyLanguage, translateText, determineDirection } = await import(
          "./translationService"
        );
        const { E2EProfiler } = await import("./profiler/e2eProfiler");
        const { BottleneckDetector } = await import("./profiler/bottleneckDetector");
        const { diagnosticsStore } = await import("./profiler/diagnosticsStore");

        // Start E2E profiling
        const e2eProfiler = new E2EProfiler();
        e2eProfiler.start("autoTranslate start");

        try {
          const audioBuffer = Buffer.from(input.audioBase64, "base64");
          const filename = input.filename || `audio-${Date.now()}.webm`;

          console.log(`[autoTranslate] Processing audio, size: ${audioBuffer.length} bytes`);

          // Step 1: Whisper transcription
          console.log(`[autoTranslate] Transcribing audio...`);
          const { text: sourceText, asrProfile } = await transcribeAudio(audioBuffer, filename);

          if (!sourceText || sourceText.trim() === "") {
            return {
              success: false,
              error: "No speech detected",
            };
          }

          console.log(`[autoTranslate] Transcript: "${sourceText}"`);

          // Step 2: LLM language identification
          console.log(`[autoTranslate] Identifying language...`);
          const detectedLanguage = await identifyLanguage(sourceText);
          console.log(`[autoTranslate] Detected language: ${detectedLanguage}`);

          // Step 3: Determine translation direction
          const targetLang = input.preferredTargetLang || "vi";
          const { direction, sourceLang, targetLang: finalTargetLang } = determineDirection(detectedLanguage, targetLang);

          console.log(`[autoTranslate] Direction: ${direction}, ${sourceLang} → ${finalTargetLang}`);

          // Step 4: Translate
          console.log(`[autoTranslate] Translating...`);
          const { translatedText, translationProfile } = await translateText(sourceText, sourceLang, finalTargetLang);
          console.log(`[autoTranslate] Translation: "${translatedText}"`);

          // End E2E profiling
          const e2eProfile = e2eProfiler.end("autoTranslate complete");

          // Create diagnostic report
          const diagnosticReport = {
            asr: asrProfile,
            translation: translationProfile,
            e2e: e2eProfile,
            bottleneck: BottleneckDetector.detect({
              asr: asrProfile,
              translation: translationProfile,
              e2e: e2eProfile,
            }),
            timestamp: Date.now(),
          };

          // Save to diagnostics store
          diagnosticsStore.setReport(diagnosticReport);

          return {
            success: true,
            sourceText,
            translatedText,
            sourceLang,
            targetLang: finalTargetLang,
            direction,
          };
        } catch (error: any) {
          console.error("[autoTranslate] Error:", error);
          return {
            success: false,
            error: error.message || "Translation failed",
          };
        }
      }),
  }),

  // Diagnostics endpoint
  diagnostics: router({
    report: publicProcedure.query(() => {
      const { diagnosticsStore } = require("./profiler/diagnosticsStore");
      const report = diagnosticsStore.getReport();

      if (!report) {
        return {
          success: false,
          error: "No diagnostic data available",
        };
      }

      return {
        success: true,
        data: report,
      };
    }),
  }),

  // TTS endpoint
  tts: router({
    generate: publicProcedure
      .input(
        z.object({
          text: z.string(),
          language: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { generateSpeech } = await import("./ttsService");

        try {
          const audioBuffer = await generateSpeech(input.text, input.language);
          const audioBase64 = audioBuffer.toString("base64");

          return {
            success: true,
            audioBase64,
          };
        } catch (error: any) {
          console.error("[TTS] Error:", error);
          return {
            success: false,
            error: error.message || "TTS generation failed",
          };
        }
      }),
  }),

  // Language detection endpoint
  language: router({
    // LLM-based language identification (99%+ accuracy)
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
          const translatedText = await translateText(input.text, input.sourceLang, input.targetLang);

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

});

export type AppRouter = typeof appRouter;
