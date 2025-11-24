import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("TTS Service", () => {
  describe("tts.generate", () => {
    it("should generate speech from Chinese text", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.tts.generate({
        text: "你好",
        language: "zh",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.audioBase64).toBeDefined();
        expect(result.audioBase64.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should generate speech from English text", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.tts.generate({
        text: "Hello",
        language: "en",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.audioBase64).toBeDefined();
        expect(result.audioBase64.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should generate speech from Vietnamese text", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.tts.generate({
        text: "Xin chào",
        language: "vi",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.audioBase64).toBeDefined();
        expect(result.audioBase64.length).toBeGreaterThan(0);
      }
    }, 30000);
  });
});
