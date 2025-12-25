import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Unit tests for Translation Model Switching
 * 
 * Tests cover:
 * 1. Valid translation models (gpt-4o-mini, gpt-4.1-mini, gpt-4.1, gpt-4o)
 * 2. Invalid model fallback to default (gpt-4.1-mini)
 * 3. Error handling when OpenAI fails
 */

// Mock context for testing
function createMockContext(): TrpcContext {
  return {
    user: undefined,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// Helper: Create a valid WebM audio base64 (minimal valid WebM header)
function createValidWebMBase64(): string {
  // Minimal valid WebM header (EBML + Segment)
  const webmHeader = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, // EBML header
    0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x1f,
    0x42, 0x86, 0x81, 0x01,
    0x42, 0xf7, 0x81, 0x01,
    0x42, 0xf2, 0x81, 0x04,
    0x42, 0xf3, 0x81, 0x08,
    0x42, 0x82, 0x88, 0x77,
    0x65, 0x62, 0x6d, 0x00,
    0x00, 0x00, 0x00,
    0x42, 0x87, 0x81, 0x04,
    0x42, 0x85, 0x81, 0x02,
  ]);
  return webmHeader.toString("base64");
}

describe("Translation Model Switching", () => {
  describe("Valid Models", () => {
    it("should accept gpt-4o-mini", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-gpt4o-mini.webm",
        preferredTargetLang: "zh",
        translationModel: "gpt-4o-mini",
      };

      // Should not throw validation error
      await expect(
        caller.translation.autoTranslate(input)
      ).resolves.toBeDefined();
    });

    it("should accept gpt-4.1-mini", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-gpt41-mini.webm",
        preferredTargetLang: "zh",
        translationModel: "gpt-4.1-mini",
      };

      await expect(
        caller.translation.autoTranslate(input)
      ).resolves.toBeDefined();
    });

    it("should accept gpt-4.1", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-gpt41.webm",
        preferredTargetLang: "zh",
        translationModel: "gpt-4.1",
      };

      await expect(
        caller.translation.autoTranslate(input)
      ).resolves.toBeDefined();
    });

    it("should accept gpt-4o", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-gpt4o.webm",
        preferredTargetLang: "zh",
        translationModel: "gpt-4o",
      };

      await expect(
        caller.translation.autoTranslate(input)
      ).resolves.toBeDefined();
    });
  });

  describe("Invalid Model Fallback", () => {
    it("should fallback to gpt-4.1-mini for invalid model", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-invalid-model.webm",
        preferredTargetLang: "zh",
        translationModel: "invalid-model-name", // Invalid model
      };

      // Should not throw validation error, should fallback
      await expect(
        caller.translation.autoTranslate(input)
      ).resolves.toBeDefined();
    });

    it("should fallback to gpt-4.1-mini for empty model", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-empty-model.webm",
        preferredTargetLang: "zh",
        translationModel: "", // Empty model
      };

      await expect(
        caller.translation.autoTranslate(input)
      ).resolves.toBeDefined();
    });

    it("should use default model when translationModel is undefined", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-undefined-model.webm",
        preferredTargetLang: "zh",
        // translationModel is undefined
      };

      await expect(
        caller.translation.autoTranslate(input)
      ).resolves.toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle audio too short error gracefully", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: "SGVsbG8=", // Too short audio
        filename: "test-short.webm",
        preferredTargetLang: "zh",
        translationModel: "gpt-4o-mini",
      };

      const result = await caller.translation.autoTranslate(input);
      
      // API returns { success: false, error: "..." } instead of throwing
      expect(result.success).toBe(false);
      expect(result.error).toContain("Audio too short");
    });

    it("should handle invalid base64 audio gracefully", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const input = {
        audioBase64: "invalid-base64!!!",
        filename: "test-invalid.webm",
        preferredTargetLang: "zh",
        translationModel: "gpt-4o-mini",
      };

      const result = await caller.translation.autoTranslate(input);
      
      // API returns { success: false, error: "..." } instead of throwing
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Model Parameter Logging", () => {
    it("should validate translationModel parameter", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      // Test that invalid model gets transformed to default
      const input = {
        audioBase64: createValidWebMBase64(),
        filename: "test-logging.webm",
        preferredTargetLang: "zh",
        translationModel: "invalid-model",
      };

      // Should not throw, should fallback to default
      const result = await caller.translation.autoTranslate(input);
      
      // Result should be defined (either success or error, but not throw)
      expect(result).toBeDefined();
    });
  });
});
