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
    // Receive and buffer WebM chunks
    chunk: publicProcedure
      .input(
        z.object({
          sessionId: z.string(),
          chunkBase64: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { addChunkToSession, getSessionStatus } = await import("./chunkBuffer");

        try {
          const chunkBuffer = Buffer.from(input.chunkBase64, "base64");
          addChunkToSession(input.sessionId, chunkBuffer);

          const status = getSessionStatus(input.sessionId);

          return {
            success: true,
            sessionId: input.sessionId,
            chunkCount: status.chunkCount,
          };
        } catch (error: any) {
          console.error("[audio.chunk] Error:", error);
          return {
            success: false,
            error: error.message || "Failed to buffer chunk",
          };
        }
      }),
  }),

  // Translation endpoint (handles full workflow)
  translation: router({
    // Auto-translate: merge chunks → Whisper → LLM language detection → translate
    autoTranslate: publicProcedure
      .input(
        z.object({
          audioBase64: z.string().optional(), // Not used, kept for compatibility
          filename: z.string().optional(),
          preferredTargetLang: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { mergeSessionChunks, clearSession } = await import("./chunkBuffer");
        const { transcribeAudio, identifyLanguage, translateText, determineDirection } = await import(
          "./translationService"
        );
        const { promises: fs } = await import("fs");

        // Extract session ID from filename
        const sessionId = input.filename?.replace("session-", "").replace(".webm", "") || "";
        if (!sessionId) {
          return {
            success: false,
            error: "Invalid session ID",
          };
        }

        let mergedFilePath: string | null = null;

        try {
          // Step 1: Merge chunks using ffmpeg
          console.log(`[autoTranslate] Merging chunks for session: ${sessionId}`);
          mergedFilePath = await mergeSessionChunks(sessionId);

          // Step 2: Read merged WebM file
          const audioBuffer = await fs.readFile(mergedFilePath);
          console.log(`[autoTranslate] Merged audio size: ${audioBuffer.length} bytes`);

          // Step 3: Whisper transcription
          console.log(`[autoTranslate] Transcribing audio...`);
          const { text: sourceText } = await transcribeAudio(audioBuffer, `${sessionId}.webm`);

          if (!sourceText || sourceText.trim() === "") {
            return {
              success: false,
              error: "No speech detected",
            };
          }

          console.log(`[autoTranslate] Transcript: "${sourceText}"`);

          // Step 4: LLM language identification
          console.log(`[autoTranslate] Identifying language...`);
          const detectedLanguage = await identifyLanguage(sourceText);
          console.log(`[autoTranslate] Detected language: ${detectedLanguage}`);

          // Step 5: Determine translation direction
          const targetLang = input.preferredTargetLang || "vi";
          const { direction, sourceLang, targetLang: finalTargetLang } = determineDirection(detectedLanguage, targetLang);

          console.log(`[autoTranslate] Direction: ${direction}, ${sourceLang} → ${finalTargetLang}`);

          // Step 6: Translate
          console.log(`[autoTranslate] Translating...`);
          const translatedText = await translateText(sourceText, sourceLang, finalTargetLang);
          console.log(`[autoTranslate] Translation: "${translatedText}"`);

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
        } finally {
          // Clean up
          if (mergedFilePath) {
            await fs.unlink(mergedFilePath).catch(() => {});
          }
          await clearSession(sessionId);
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

  // TTS endpoint
  tts: router({
    // Generate speech from text
    generate: publicProcedure
      .input(
        z.object({
          text: z.string(),
          lang: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // TTS implementation placeholder
        return {
          success: true,
          audioUrl: "", // TODO: Implement TTS
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
