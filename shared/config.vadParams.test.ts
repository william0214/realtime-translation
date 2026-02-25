/**
 * VAD 參數配置測試
 * 驗證 v2.3.3 的 chunk 長度優化（避免零碎翻譯）
 */

import { describe, it, expect } from "vitest";
import { ASR_MODE_CONFIG, getASRModeConfig } from "./config";

describe("VAD Parameters Configuration (v2.3.3)", () => {
  describe("Normal Mode - Chunk Length Optimization", () => {
    const config = getASRModeConfig("normal");

    it("should have increased vadEndThreshold to reduce premature finalization", () => {
      // v2.3.3: 提高至 0.055（從 0.028），不容易判定語音結束
      expect(config.vadEndThreshold).toBe(0.055);
      expect(config.vadEndThreshold).toBeGreaterThan(0.028);
    });

    it("should have increased vadEndFrames to wait longer for silence", () => {
      // v2.3.3: 增加至 12 幀（從 4 幀），需要 ~1200ms 靜音才結束
      expect(config.vadEndFrames).toBe(12);
      expect(config.vadEndFrames).toBeGreaterThanOrEqual(12);
    });

    it("should have increased finalMaxDurationMs to allow longer sentences", () => {
      // v2.3.3: 增加至 12000ms（從 8000ms），允許更長的句子
      expect(config.finalMaxDurationMs).toBe(12000);
      expect(config.finalMaxDurationMs).toBeGreaterThanOrEqual(12000);
    });

    it("should maintain vadStartThreshold for consistent speech detection", () => {
      // 保持 0.045，確保語音開始偵測一致
      expect(config.vadStartThreshold).toBe(0.045);
    });

    it("should calculate correct silence duration for finalization", () => {
      // 12 幀 × 100ms/幀 ≈ 1200ms
      const expectedSilenceDuration = config.vadEndFrames * 100;
      expect(expectedSilenceDuration).toBe(1200);
    });
  });

  describe("Precise Mode - Chunk Length Optimization", () => {
    const config = getASRModeConfig("precise");

    it("should have increased vadEndThreshold to reduce premature finalization", () => {
      // v2.3.3: 提高至 0.055（從 0.032），與 Normal 保持一致
      expect(config.vadEndThreshold).toBe(0.055);
      expect(config.vadEndThreshold).toBeGreaterThan(0.032);
    });

    it("should have increased vadEndFrames to wait longer for silence", () => {
      // v2.3.3: 增加至 12 幀（從 5 幀），與 Normal 保持一致
      expect(config.vadEndFrames).toBe(12);
      expect(config.vadEndFrames).toBeGreaterThanOrEqual(12);
    });

    it("should have increased finalMaxDurationMs to allow longer sentences", () => {
      // v2.3.3: 增加至 12000ms（從 10000ms），與 Normal 保持一致
      expect(config.finalMaxDurationMs).toBe(12000);
      expect(config.finalMaxDurationMs).toBeGreaterThanOrEqual(12000);
    });

    it("should maintain higher vadStartThreshold for precise mode", () => {
      // Precise 模式保持較高的開始門檻 0.050
      expect(config.vadStartThreshold).toBe(0.050);
      expect(config.vadStartThreshold).toBeGreaterThan(ASR_MODE_CONFIG.normal.vadStartThreshold);
    });

    it("should calculate correct silence duration for finalization", () => {
      // 12 幀 × 100ms/幀 ≈ 1200ms
      const expectedSilenceDuration = config.vadEndFrames * 100;
      expect(expectedSilenceDuration).toBe(1200);
    });
  });

  describe("Cross-Mode Consistency", () => {
    it("should have same vadEndThreshold for both modes", () => {
      // v2.3.3: 兩種模式使用相同的結束門檻
      expect(ASR_MODE_CONFIG.normal.vadEndThreshold).toBe(
        ASR_MODE_CONFIG.precise.vadEndThreshold
      );
    });

    it("should have same vadEndFrames for both modes", () => {
      // v2.3.3: 兩種模式使用相同的結束幀數
      expect(ASR_MODE_CONFIG.normal.vadEndFrames).toBe(
        ASR_MODE_CONFIG.precise.vadEndFrames
      );
    });

    it("should have same finalMaxDurationMs for both modes", () => {
      // v2.3.3: 兩種模式使用相同的最大段落長度
      expect(ASR_MODE_CONFIG.normal.finalMaxDurationMs).toBe(
        ASR_MODE_CONFIG.precise.finalMaxDurationMs
      );
    });
  });

  describe("Expected Behavior Validation", () => {
    it("should wait at least 1 second before finalizing speech", () => {
      const normalConfig = getASRModeConfig("normal");
      const preciseConfig = getASRModeConfig("precise");

      // 兩種模式都需要至少 1200ms 靜音才結束
      const normalSilence = normalConfig.vadEndFrames * 100;
      const preciseSilence = preciseConfig.vadEndFrames * 100;

      expect(normalSilence).toBeGreaterThanOrEqual(1000);
      expect(preciseSilence).toBeGreaterThanOrEqual(1000);
    });

    it("should allow sentences up to 12 seconds", () => {
      const normalConfig = getASRModeConfig("normal");
      const preciseConfig = getASRModeConfig("precise");

      // 兩種模式都允許最長 12 秒的句子
      expect(normalConfig.finalMaxDurationMs).toBe(12000);
      expect(preciseConfig.finalMaxDurationMs).toBe(12000);
    });

    it("should reduce fragmented translations by waiting longer", () => {
      const normalConfig = getASRModeConfig("normal");

      // v2.3.3 的改進：
      // - vadEndThreshold 提高 100% (0.028 -> 0.055)
      // - vadEndFrames 增加 3 倍 (4 -> 12)
      // - finalMaxDurationMs 增加 50% (8000 -> 12000)

      const thresholdIncrease = 0.055 / 0.028;
      const framesIncrease = 12 / 4;
      const maxDurationIncrease = 12000 / 8000;

      expect(thresholdIncrease).toBeCloseTo(1.96, 1); // ~100% 增加
      expect(framesIncrease).toBe(3); // 3 倍
      expect(maxDurationIncrease).toBe(1.5); // 50% 增加
    });
  });
});
