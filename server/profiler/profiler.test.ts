import { describe, expect, it } from "vitest";
import { ASRProfiler } from "./asrProfiler";
import { TranslationProfiler } from "./translationProfiler";
import { TTSProfiler } from "./ttsProfiler";
import { ChunkProfiler } from "./chunkProfiler";
import { E2EProfiler } from "./e2eProfiler";
import { BottleneckDetector } from "./bottleneckDetector";

describe("Profiler Modules", () => {
  describe("ASRProfiler", () => {
    it("should measure ASR latency", async () => {
      const profiler = new ASRProfiler();
      profiler.start();

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = profiler.end(1.5, 50000, "whisper-1");

      expect(result.duration).toBeGreaterThan(0);
      expect(result.metadata.audioDuration).toBe(1.5);
      expect(result.metadata.fileSize).toBe(50000);
      expect(result.metadata.model).toBe("whisper-1");
    });
  });

  describe("TranslationProfiler", () => {
    it("should measure translation latency", async () => {
      const profiler = new TranslationProfiler();
      profiler.start();

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = profiler.end("Hello world", "en", "zh", "gpt-4o-mini");

      expect(result.duration).toBeGreaterThan(0);
      expect(result.metadata.textLength).toBe(11);
      expect(result.metadata.sourceLang).toBe("en");
      expect(result.metadata.targetLang).toBe("zh");
      expect(result.metadata.model).toBe("gpt-4o-mini");
    });
  });

  describe("TTSProfiler", () => {
    it("should measure TTS latency", async () => {
      const profiler = new TTSProfiler();
      profiler.start();

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 80));

      const result = profiler.end("你好世界", 2.0, "tts-1");

      expect(result.duration).toBeGreaterThanOrEqual(80);
      expect(result.metadata.textLength).toBe(4);
      expect(result.metadata.audioDuration).toBe(2.0);
      expect(result.metadata.model).toBe("tts-1");
    });
  });

  describe("ChunkProfiler", () => {
    it("should measure chunk processing", async () => {
      const profiler = new ChunkProfiler();
      profiler.start();

      profiler.startUpload();

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 30));

      const result = profiler.end(48000, 1.0, 100000);

      expect(result.duration).toBeGreaterThan(0);
      expect(result.metadata.pcmFrameCount).toBe(48000);
      expect(result.metadata.chunkDuration).toBe(1.0);
      expect(result.metadata.chunkSize).toBe(100000);
      expect(result.metadata.uploadTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("E2EProfiler", () => {
    it("should measure end-to-end latency", async () => {
      const profiler = new E2EProfiler();
      profiler.start("Test start");

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 200));

      const result = profiler.end("Test complete");

      expect(result.duration).toBeGreaterThanOrEqual(200);
      expect(result.metadata.stage).toBe("Test complete");
    });
  });

  describe("BottleneckDetector", () => {
    it("should detect no bottleneck when all metrics are good", () => {
      const result = BottleneckDetector.detect({
        asr: {
          startTime: 0,
          endTime: 500,
          duration: 500,
          metadata: { audioDuration: 1.0, fileSize: 50000, model: "whisper-1" },
        },
        translation: {
          startTime: 500,
          endTime: 700,
          duration: 200,
          metadata: { textLength: 10, sourceLang: "en", targetLang: "zh", model: "gpt-4o-mini" },
        },
        e2e: {
          startTime: 0,
          endTime: 700,
          duration: 700,
          metadata: { stage: "complete" },
        },
      });

      expect(result.severity).toBe("green");
      expect(result.bottleneck).toBe("None");
    });

    it("should detect ASR bottleneck when ASR is slow", () => {
      const result = BottleneckDetector.detect({
        asr: {
          startTime: 0,
          endTime: 1600,
          duration: 1600, // > 1500ms (red threshold)
          metadata: { audioDuration: 1.0, fileSize: 50000, model: "whisper-1" },
        },
      });

      expect(result.severity).toBe("red");
      expect(result.bottleneck).toContain("ASR");
    });

    it("should detect translation bottleneck when translation is slow", () => {
      const result = BottleneckDetector.detect({
        translation: {
          startTime: 0,
          endTime: 700,
          duration: 700, // > 600ms (red threshold)
          metadata: { textLength: 10, sourceLang: "en", targetLang: "zh", model: "gpt-4o-mini" },
        },
      });

      expect(result.severity).toBe("red");
      expect(result.bottleneck).toContain("Translation");
    });

    it("should detect chunk size bottleneck", () => {
      const result = BottleneckDetector.detect({
        chunk: {
          startTime: 0,
          endTime: 100,
          duration: 100,
          metadata: {
            pcmFrameCount: 48000,
            chunkDuration: 1.0,
            chunkSize: 300 * 1024, // > 250KB (red threshold)
            uploadTime: 100,
          },
        },
      });

      expect(result.severity).toBe("red");
      expect(result.bottleneck).toContain("Chunk");
    });

    it("should detect network bottleneck", () => {
      const result = BottleneckDetector.detect({
        chunk: {
          startTime: 0,
          endTime: 500,
          duration: 500,
          metadata: {
            pcmFrameCount: 48000,
            chunkDuration: 1.0,
            chunkSize: 100 * 1024,
            uploadTime: 500, // > 400ms (red threshold)
          },
        },
      });

      expect(result.severity).toBe("red");
      expect(result.bottleneck).toContain("Network");
    });

    it("should detect E2E bottleneck", () => {
      const result = BottleneckDetector.detect({
        e2e: {
          startTime: 0,
          endTime: 1600,
          duration: 1600, // > 1500ms (red threshold)
          metadata: { stage: "complete" },
        },
      });

      expect(result.severity).toBe("red");
      expect(result.bottleneck).toContain("E2E");
    });
  });
});
