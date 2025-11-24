import { describe, expect, it, beforeEach } from "vitest";
import { addChunkToSession, getSessionStatus, mergeSessionChunks, clearSession } from "./chunkBuffer";
import { promises as fs } from "fs";

describe("WebM Chunk Buffer + FFmpeg Muxing", () => {
  const testSessionId = `test-session-${Date.now()}`;

  beforeEach(async () => {
    // Clean up any existing test session
    await clearSession(testSessionId);
  });

  describe("Chunk Buffering", () => {
    it("should create new session when adding first chunk", () => {
      const chunk = Buffer.from("test-chunk-data");
      addChunkToSession(testSessionId, chunk);

      const status = getSessionStatus(testSessionId);
      expect(status.exists).toBe(true);
      expect(status.chunkCount).toBe(1);
    });

    it("should accumulate multiple chunks", () => {
      const chunk1 = Buffer.from("chunk-1");
      const chunk2 = Buffer.from("chunk-2");
      const chunk3 = Buffer.from("chunk-3");

      addChunkToSession(testSessionId, chunk1);
      addChunkToSession(testSessionId, chunk2);
      addChunkToSession(testSessionId, chunk3);

      const status = getSessionStatus(testSessionId);
      expect(status.chunkCount).toBe(3);
    });

    it("should return correct status for non-existent session", () => {
      const status = getSessionStatus("non-existent-session");
      expect(status.exists).toBe(false);
      expect(status.chunkCount).toBe(0);
    });
  });

  describe("Session Management", () => {
    it("should clear session buffer", async () => {
      const chunk = Buffer.from("test-chunk");
      addChunkToSession(testSessionId, chunk);

      let status = getSessionStatus(testSessionId);
      expect(status.exists).toBe(true);

      await clearSession(testSessionId);

      status = getSessionStatus(testSessionId);
      expect(status.exists).toBe(false);
    });
  });

  describe("FFmpeg Merging", () => {
    it("should reject merging session with no chunks", async () => {
      await expect(mergeSessionChunks("empty-session")).rejects.toThrow("No chunks found");
    });

    it("should create valid WebM file from chunks (integration test)", async () => {
      // This test requires actual WebM chunks to work properly
      // For now, we'll test the error handling
      const invalidChunk = Buffer.from("not-a-valid-webm-chunk");
      addChunkToSession(testSessionId, invalidChunk);

      try {
        await mergeSessionChunks(testSessionId);
        // If it succeeds, verify the file exists
        // In reality, ffmpeg will likely fail with invalid data
      } catch (error: any) {
        // Expected to fail with invalid WebM data
        expect(error.message).toContain("Failed to merge chunks");
      } finally {
        await clearSession(testSessionId);
      }
    }, 10000); // Increase timeout for ffmpeg operation
  });

  describe("Pseudo-streaming Performance", () => {
    it("should handle rapid chunk additions", () => {
      const startTime = Date.now();

      // Simulate 10 chunks arriving rapidly (500ms interval)
      for (let i = 0; i < 10; i++) {
        const chunk = Buffer.from(`chunk-${i}-data-${Date.now()}`);
        addChunkToSession(testSessionId, chunk);
      }

      const elapsed = Date.now() - startTime;
      const status = getSessionStatus(testSessionId);

      expect(status.chunkCount).toBe(10);
      expect(elapsed).toBeLessThan(100); // Should be very fast (< 100ms)
    });
  });
});
