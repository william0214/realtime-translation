import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { diagnosticsStore } from "./profiler/diagnosticsStore";
import { transcribeAudio, identifyLanguage, translateText, determineDirection } from "./translationService";
import { E2EProfiler } from "./profiler/e2eProfiler";
import { BottleneckDetector } from "./profiler/bottleneckDetector";

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
          asrMode: z.enum(["normal", "precise"]).optional(),
          transcriptOnly: z.boolean().optional(), // If true, only do transcription, no translation
        })
      )
      .mutation(async ({ input }) => {
        // Use static imports to ensure singleton diagnosticsStore

        // ===== 時間戳記：收到音訊 =====
        const receivedAt = new Date();
        console.log(`\n========================================`);
        console.log(`[時間戳記] 收到音訊: ${receivedAt.toISOString()} (${receivedAt.getTime()})`);
        console.log(`========================================\n`);

        // Start E2E profiling
        const e2eProfiler = new E2EProfiler();
        e2eProfiler.start("autoTranslate start");

        try {
          const audioBuffer = Buffer.from(input.audioBase64, "base64");
          const filename = input.filename || `audio-${Date.now()}.webm`;

          console.log(`[autoTranslate] Processing audio, size: ${audioBuffer.length} bytes`);
          
          // Estimate audio duration (WebM with Opus: ~6KB per second at 48kbps)
          // Skip if audio is too short (< 600 bytes ≈ 0.1 seconds)
          if (audioBuffer.length < 600) {
            console.log(`[autoTranslate] Audio too short (${audioBuffer.length} bytes < 600 bytes), skipping`);
            return {
              success: false,
              error: "Audio too short (minimum 0.1 seconds required)",
            };
          }

          // Step 1: Whisper transcription (with language detection)
          const whisperStartAt = new Date();
          console.log(`[時間戳記] 開始 Whisper 識別: ${whisperStartAt.toISOString()}`);
          console.log(`[autoTranslate] Transcribing audio...`);
          const { text: sourceText, language: whisperLanguage, asrProfile } = await transcribeAudio(audioBuffer, filename, input.asrMode);
          const whisperEndAt = new Date();
          const whisperDuration = whisperEndAt.getTime() - whisperStartAt.getTime();
          console.log(`[時間戳記] Whisper 完成: ${whisperEndAt.toISOString()} (耗時 ${whisperDuration}ms)`);

          if (!sourceText || sourceText.trim() === "") {
            console.log(`[autoTranslate] No speech detected in audio`);
            return {
              success: false,
              error: "No speech detected",
              sourceText: "",
              translatedText: "",
              sourceLang: "unknown",
              targetLang: input.preferredTargetLang || "vi",
              direction: "unknown",
            };
          }

          console.log(`[autoTranslate] Transcript: "${sourceText}", Whisper language: ${whisperLanguage}`);

          // If transcriptOnly is true, skip translation and return transcript only
          if (input.transcriptOnly) {
            console.log(`[autoTranslate] transcriptOnly=true, skipping translation`);
            
            // End E2E profiling
            const e2eProfile = e2eProfiler.end("autoTranslate complete (transcript only)");
            const completedAt = new Date();
            const totalDuration = completedAt.getTime() - receivedAt.getTime();
            
            console.log(`\n========================================`);
            console.log(`[時間戳記] 全部完成: ${completedAt.toISOString()}`);
            console.log(`[時間統計] Whisper: ${whisperDuration}ms`);
            console.log(`[時間統計] 總耗時: ${totalDuration}ms`);
            console.log(`========================================\n`);
            
            return {
              success: true,
              sourceText,
              translatedText: "", // No translation
              sourceLang: whisperLanguage || "zh",
              targetLang: input.preferredTargetLang || "vi",
              direction: "unknown",
            };
          }

          // Use Whisper's language detection directly (with Smart Language Hint retry mechanism)
          // No need for LLM language detection anymore (saves 0.5-1 second)
          const detectedLanguage = whisperLanguage || "zh";
          console.log(`[autoTranslate] Using Whisper detected language: ${detectedLanguage}`);

          // Step 2: Determine translation direction
          const targetLang = input.preferredTargetLang || "vi";
          const { direction, sourceLang, targetLang: finalTargetLang } = determineDirection(detectedLanguage, targetLang);

          console.log(`[autoTranslate] Direction: ${direction}, ${sourceLang} → ${finalTargetLang}`);

          // Step 3: Translate
          const translateStartAt = new Date();
          console.log(`[時間戳記] 開始翻譯: ${translateStartAt.toISOString()}`);
          console.log(`[autoTranslate] Translating...`);
          const { translatedText, translationProfile } = await translateText(sourceText, sourceLang, finalTargetLang, input.asrMode);
          const translateEndAt = new Date();
          const translateDuration = translateEndAt.getTime() - translateStartAt.getTime();
          console.log(`[時間戳記] 翻譯完成: ${translateEndAt.toISOString()} (耗時 ${translateDuration}ms)`);
          console.log(`[autoTranslate] Translation: "${translatedText}"`);

          // End E2E profiling
          const e2eProfile = e2eProfiler.end("autoTranslate complete");
          const completedAt = new Date();
          const totalDuration = completedAt.getTime() - receivedAt.getTime();
          
          console.log(`\n========================================`);
          console.log(`[時間戳記] 全部完成: ${completedAt.toISOString()}`);
          console.log(`[時間統計] Whisper (forced Chinese): ${whisperDuration}ms`);
          console.log(`[時間統計] 翻譯: ${translateDuration}ms`);
          console.log(`[時間統計] 總耗時: ${totalDuration}ms`);
          console.log(`========================================\n`);

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
          
          // Determine error stage
          let errorStage = "未知環節";
          let errorDetail = error.message || "未知錯誤";
          
          if (errorDetail.includes("transcribe") || errorDetail.includes("Whisper") || errorDetail.includes("ASR")) {
            errorStage = "語音識別（ASR）";
          } else if (errorDetail.includes("translate") || errorDetail.includes("translation")) {
            errorStage = "翻譯";
          } else if (errorDetail.includes("language") || errorDetail.includes("detect")) {
            errorStage = "語言偵測";
          } else if (errorDetail.includes("network") || errorDetail.includes("fetch") || errorDetail.includes("timeout")) {
            errorStage = "網路連線";
          }
          
          return {
            success: false,
            error: `${errorStage}失敗: ${errorDetail}`,
          };
        }
      }),
  }),

  // Diagnostics endpoint
  diagnostics: router({
    report: publicProcedure.query(() => {
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

  // Conversation history endpoints
  conversation: router({
    // Create a new conversation
    create: publicProcedure
      .input(
        z.object({
          targetLanguage: z.string(),
          title: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { createConversation } = await import("./db");

        try {
          const conversationId = await createConversation({
            userId: ctx.user?.id,
            targetLanguage: input.targetLanguage,
            title: input.title,
          });

          return {
            success: true,
            conversationId,
          };
        } catch (error: any) {
          console.error("[Conversation] Create error:", error);
          return {
            success: false,
            error: error.message || "Failed to create conversation",
          };
        }
      }),

    // End a conversation
    end: publicProcedure
      .input(
        z.object({
          conversationId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const { endConversation } = await import("./db");

        try {
          await endConversation(input.conversationId);

          return {
            success: true,
          };
        } catch (error: any) {
          console.error("[Conversation] End error:", error);
          return {
            success: false,
            error: error.message || "Failed to end conversation",
          };
        }
      }),

    // Get recent conversations
    list: publicProcedure
      .input(
        z.object({
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const { getRecentConversations } = await import("./db");

        try {
          const conversations = await getRecentConversations(input.limit);

          return {
            success: true,
            conversations,
          };
        } catch (error: any) {
          console.error("[Conversation] List error:", error);
          return {
            success: false,
            error: error.message || "Failed to get conversations",
            conversations: [],
          };
        }
      }),

    // Get conversation with translations
    getWithTranslations: publicProcedure
      .input(
        z.object({
          conversationId: z.number(),
        })
      )
      .query(async ({ input }) => {
        const { getConversationById, getTranslationsByConversationId } = await import("./db");

        try {
          const conversation = await getConversationById(input.conversationId);
          const translations = await getTranslationsByConversationId(input.conversationId);

          return {
            success: true,
            conversation,
            translations,
          };
        } catch (error: any) {
          console.error("[Conversation] Get error:", error);
          return {
            success: false,
            error: error.message || "Failed to get conversation",
          };
        }
      }),

    // Save translation to conversation
    saveTranslation: publicProcedure
      .input(
        z.object({
          conversationId: z.number().optional(),
          direction: z.string(),
          sourceLang: z.string(),
          targetLang: z.string(),
          sourceText: z.string(),
          translatedText: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { insertTranslation } = await import("./db");

        try {
          await insertTranslation({
            conversationId: input.conversationId,
            direction: input.direction,
            sourceLang: input.sourceLang,
            targetLang: input.targetLang,
            sourceText: input.sourceText,
            translatedText: input.translatedText,
            userId: ctx.user?.id,
          });

          return {
            success: true,
          };
        } catch (error: any) {
          console.error("[Conversation] Save translation error:", error);
          return {
            success: false,
            error: error.message || "Failed to save translation",
          };
        }
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
            error: `TTS 語音合成失敗: ${error.message || '未知錯誤'}`,
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
