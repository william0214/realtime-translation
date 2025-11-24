import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  translation: router({
    // Auto translate: ASR + Translation + TTS in one call
    autoTranslate: publicProcedure
      .input(z.object({
        audioBase64: z.string(),
        filename: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { transcribeAudio, determineDirection, translateText } = await import("./translationService");
        const { insertTranslation } = await import("./db");


        // Decode base64 audio
        const audioBuffer = Buffer.from(input.audioBase64, "base64");
        const filename = input.filename || `audio-${Date.now()}.webm`;

        // Step 1: ASR - Transcribe audio
        const { text: sourceText, language } = await transcribeAudio(audioBuffer, filename);

        if (!sourceText || sourceText.trim() === "") {
          return {
            success: false,
            error: "No speech detected",
          };
        }

        // Step 2: Determine direction
        const { direction, sourceLang, targetLang } = determineDirection(language);

        // Step 3: Translate
        const translatedText = await translateText(sourceText, sourceLang, targetLang);

        // TTS 功能已移除
        const audioUrl = "";

        // Step 5: Save to database
        await insertTranslation({
          direction,
          sourceLang,
          targetLang,
          sourceText,
          translatedText,
          audioUrl,
        });

        return {
          success: true,
          direction,
          sourceLang,
          targetLang,
          sourceText,
          translatedText,
          audioUrl,
        };
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
