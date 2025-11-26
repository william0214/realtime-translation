import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Create a test context with authenticated user
function createTestContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

// Helper function to create test audio buffer (silence)
function createTestAudioBuffer(durationSeconds: number = 1): Buffer {
  // Create a simple WAV file with silence
  const sampleRate = 48000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Fill with silence (zeros)
  buffer.fill(0, 44);
  
  return buffer;
}

describe("Realtime Translation API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const { ctx } = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("autoTranslate - Basic Functionality", () => {
    it("should accept audio buffer and return transcription and translation", async () => {
      // Create test audio buffer
      const audioBuffer = createTestAudioBuffer(1);
      const base64Audio = audioBuffer.toString("base64");

      // Call translation API
      const result = await caller.translation.autoTranslate({
        audioBase64: base64Audio,
        preferredTargetLang: "vi",
      });

      // Verify response structure
      expect(result).toHaveProperty("success");
      
      if (result.success) {
        expect(result).toHaveProperty("sourceText");
        expect(result).toHaveProperty("translatedText");
        expect(result).toHaveProperty("sourceLang");
        expect(result).toHaveProperty("targetLang");
        expect(result).toHaveProperty("direction");

        // Verify types
        expect(typeof result.sourceText).toBe("string");
        expect(typeof result.translatedText).toBe("string");
        expect(typeof result.sourceLang).toBe("string");
        expect(typeof result.targetLang).toBe("string");
        expect(typeof result.direction).toBe("string");
      } else {
        expect(result).toHaveProperty("error");
        expect(typeof result.error).toBe("string");
      }

      // Log results for manual inspection
      console.log("\n========================================");
      console.log("[Translation Test] Results:");
      if (result.success) {
        console.log("Source Text:", result.sourceText);
        console.log("Translated Text:", result.translatedText);
        console.log("Source Language:", result.sourceLang);
        console.log("Target Language:", result.targetLang);
        console.log("Direction:", result.direction);
      } else {
        console.log("Error:", result.error);
      }
      console.log("========================================\n");
    }, 30000); // 30 second timeout for API calls

    it("should handle different target languages", async () => {
      const audioBuffer = createTestAudioBuffer(1);
      const base64Audio = audioBuffer.toString("base64");

      const languages = ["vi", "en", "id", "th"];

      for (const targetLang of languages) {
        const result = await caller.translation.autoTranslate({
          audioBase64: base64Audio,
          preferredTargetLang: targetLang,
        });

        expect(result).toHaveProperty("success");
        
        if (result.success) {
          expect(result).toHaveProperty("sourceText");
          expect(result).toHaveProperty("translatedText");
          console.log(`\n[${targetLang}] Source: ${result.sourceText}`);
          console.log(`[${targetLang}] Translation: ${result.translatedText}`);
        } else {
          console.log(`\n[${targetLang}] Error: ${result.error}`);
        }
      }
    }, 60000); // 60 second timeout for multiple API calls
  });

  describe("Error Handling", () => {
    it("should handle empty audio gracefully", async () => {
      const emptyBuffer = Buffer.alloc(44); // WAV header only
      const base64Audio = emptyBuffer.toString("base64");

      const result = await caller.translation.autoTranslate({
        audioBase64: base64Audio,
        preferredTargetLang: "vi",
      });

      // Empty audio should return error
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");

      console.log("\n[Empty Audio] Error:", result.error);
    }, 30000);

    it("should handle invalid base64 audio", async () => {
      const result = await caller.translation.autoTranslate({
        audioBase64: "invalid-base64!!!",
        preferredTargetLang: "vi",
      });
      
      // Invalid audio should return error
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
      
      console.log("\n[Invalid Audio] Error:", result.error);
    });

    it("should handle missing audio", async () => {
      const result = await caller.translation.autoTranslate({
        audioBase64: "",
        preferredTargetLang: "vi",
      });
      
      // Missing audio should return error
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
      
      console.log("\n[Missing Audio] Error:", result.error);
    });
  });

  describe("Performance Tests", () => {
    it("should complete translation within acceptable time (< 5 seconds)", async () => {
      const audioBuffer = createTestAudioBuffer(1);
      const base64Audio = audioBuffer.toString("base64");

      const startTime = Date.now();
      const result = await caller.translation.autoTranslate({
        audioBase64: base64Audio,
        preferredTargetLang: "vi",
      });
      const endTime = Date.now();

      const actualLatency = endTime - startTime;

      console.log("\n========================================");
      console.log("[Performance Test]");
      console.log("Actual Wall Clock Time:", actualLatency, "ms");
      console.log("Success:", result.success);
      console.log("========================================\n");

      // Verify latency is within acceptable range (< 5 seconds)
      expect(actualLatency).toBeLessThan(5000);
    }, 30000);

    it("should handle consecutive translations efficiently", async () => {
      const audioBuffer = createTestAudioBuffer(1);
      const base64Audio = audioBuffer.toString("base64");

      const numTranslations = 3;
      const latencies: number[] = [];

      console.log("\n========================================");
      console.log("[Consecutive Translations Test]");

      for (let i = 0; i < numTranslations; i++) {
        const startTime = Date.now();
        const result = await caller.translation.autoTranslate({
          audioBase64: base64Audio,
          preferredTargetLang: "vi",
        });
        const endTime = Date.now();

        const latency = endTime - startTime;
        latencies.push(latency);

        console.log(`\nTranslation ${i + 1}:`);
        if (result.success) {
          console.log("  Source:", result.sourceText);
          console.log("  Translation:", result.translatedText);
        } else {
          console.log("  Error:", result.error);
        }
        console.log("  Latency:", latency, "ms");
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log("\nAverage Latency:", avgLatency.toFixed(2), "ms");
      console.log("========================================\n");

      // All translations should complete within reasonable time (< 6 seconds)
      latencies.forEach((latency) => {
        expect(latency).toBeLessThan(6000);
      });
    }, 60000);
  });

  describe("Continuous Translation Simulation", () => {
    it("should handle rapid consecutive translations (simulating continuous speech)", async () => {
      const audioBuffer = createTestAudioBuffer(1);
      const base64Audio = audioBuffer.toString("base64");

      const numSegments = 5;
      const results: Array<{
        transcript: string;
        translation: string;
        latency: number;
      }> = [];

      console.log("\n========================================");
      console.log("[Continuous Translation Simulation]");
      console.log(`Simulating ${numSegments} consecutive speech segments...\n`);

      for (let i = 0; i < numSegments; i++) {
        const startTime = Date.now();
        const result = await caller.translation.autoTranslate({
          audioBase64: base64Audio,
          preferredTargetLang: "vi",
        });
        const endTime = Date.now();

        const latency = endTime - startTime;
        
        if (result.success) {
          results.push({
            transcript: result.sourceText,
            translation: result.translatedText,
            latency,
          });

          console.log(`Segment ${i + 1}:`);
          console.log(`  Source: ${result.sourceText}`);
          console.log(`  Translation: ${result.translatedText}`);
          console.log(`  Latency: ${latency} ms\n`);
        } else {
          console.log(`Segment ${i + 1}: Error - ${result.error}\n`);
        }
      }

      // Calculate statistics
      const latencies = results.map((r) => r.latency);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log("Statistics:");
      console.log(`  Average Latency: ${avgLatency.toFixed(2)} ms`);
      console.log(`  Min Latency: ${minLatency} ms`);
      console.log(`  Max Latency: ${maxLatency} ms`);
      console.log("========================================\n");

      // Verify all translations completed successfully
      expect(results.length).toBe(numSegments);
      results.forEach((result) => {
        expect(result.transcript).toBeDefined();
        expect(result.translation).toBeDefined();
        expect(result.latency).toBeGreaterThan(0);
        expect(result.latency).toBeLessThan(10000); // Should complete within 10 seconds
      });

      // Average latency should be reasonable
      expect(avgLatency).toBeLessThan(5000);
    }, 90000); // 90 second timeout for multiple consecutive calls
  });
});
