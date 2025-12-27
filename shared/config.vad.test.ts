import { describe, it, expect } from "vitest";
import { getASRModeConfig } from "./config";

describe("VAD Speech END 參數優化 (v2.3.1)", () => {
  describe("Normal 模式 VAD 參數", () => {
    const normalConfig = getASRModeConfig("normal");

    it("應該維持 vadStartThreshold 為 0.045", () => {
      expect(normalConfig.vadStartThreshold).toBe(0.045);
    });

    it("應該將 vadEndThreshold 降低至 0.028（降低 20%）", () => {
      expect(normalConfig.vadEndThreshold).toBe(0.028);
    });

    it("應該維持 vadStartFrames 為 2", () => {
      expect(normalConfig.vadStartFrames).toBe(2);
    });

    it("應該將 vadEndFrames 減半至 4", () => {
      expect(normalConfig.vadEndFrames).toBe(4);
    });

    it("vadEndThreshold 應該低於 vadStartThreshold（hysteresis）", () => {
      expect(normalConfig.vadEndThreshold).toBeLessThan(normalConfig.vadStartThreshold);
    });

    it("應該計算出正確的 Speech END 延遲（~400ms）", () => {
      // endFrames × 100ms per frame = expected delay
      const expectedDelayMs = normalConfig.vadEndFrames * 100;
      expect(expectedDelayMs).toBe(400);
    });
  });

  describe("Precise 模式 VAD 參數", () => {
    const preciseConfig = getASRModeConfig("precise");

    it("應該維持 vadStartThreshold 為 0.050", () => {
      expect(preciseConfig.vadStartThreshold).toBe(0.050);
    });

    it("應該將 vadEndThreshold 降低至 0.032（降低 20%）", () => {
      expect(preciseConfig.vadEndThreshold).toBe(0.032);
    });

    it("應該維持 vadStartFrames 為 3", () => {
      expect(preciseConfig.vadStartFrames).toBe(3);
    });

    it("應該將 vadEndFrames 減半至 5", () => {
      expect(preciseConfig.vadEndFrames).toBe(5);
    });

    it("vadEndThreshold 應該低於 vadStartThreshold（hysteresis）", () => {
      expect(preciseConfig.vadEndThreshold).toBeLessThan(preciseConfig.vadStartThreshold);
    });

    it("應該計算出正確的 Speech END 延遲（~500ms）", () => {
      // endFrames × 100ms per frame = expected delay
      const expectedDelayMs = preciseConfig.vadEndFrames * 100;
      expect(expectedDelayMs).toBe(500);
    });
  });

  describe("兩種模式的相對關係", () => {
    const normalConfig = getASRModeConfig("normal");
    const preciseConfig = getASRModeConfig("precise");

    it("Precise 模式的 vadStartThreshold 應該高於 Normal 模式", () => {
      expect(preciseConfig.vadStartThreshold).toBeGreaterThan(normalConfig.vadStartThreshold);
    });

    it("Precise 模式的 vadEndThreshold 應該高於 Normal 模式", () => {
      expect(preciseConfig.vadEndThreshold).toBeGreaterThan(normalConfig.vadEndThreshold);
    });

    it("Precise 模式的 vadStartFrames 應該高於或等於 Normal 模式", () => {
      expect(preciseConfig.vadStartFrames).toBeGreaterThanOrEqual(normalConfig.vadStartFrames);
    });

    it("Precise 模式的 vadEndFrames 應該高於 Normal 模式", () => {
      expect(preciseConfig.vadEndFrames).toBeGreaterThan(normalConfig.vadEndFrames);
    });

    it("Normal 模式應該比 Precise 模式更快觸發 Speech END", () => {
      const normalDelayMs = normalConfig.vadEndFrames * 100;
      const preciseDelayMs = preciseConfig.vadEndFrames * 100;
      expect(normalDelayMs).toBeLessThan(preciseDelayMs);
    });
  });

  describe("VAD 參數合理性檢查", () => {
    const normalConfig = getASRModeConfig("normal");
    const preciseConfig = getASRModeConfig("precise");

    it("所有 threshold 值應該在合理範圍內（0.01-0.15）", () => {
      expect(normalConfig.vadStartThreshold).toBeGreaterThan(0.01);
      expect(normalConfig.vadStartThreshold).toBeLessThan(0.15);
      expect(normalConfig.vadEndThreshold).toBeGreaterThan(0.01);
      expect(normalConfig.vadEndThreshold).toBeLessThan(0.15);
      expect(preciseConfig.vadStartThreshold).toBeGreaterThan(0.01);
      expect(preciseConfig.vadStartThreshold).toBeLessThan(0.15);
      expect(preciseConfig.vadEndThreshold).toBeGreaterThan(0.01);
      expect(preciseConfig.vadEndThreshold).toBeLessThan(0.15);
    });

    it("所有 frames 值應該在合理範圍內（1-15）", () => {
      expect(normalConfig.vadStartFrames).toBeGreaterThanOrEqual(1);
      expect(normalConfig.vadStartFrames).toBeLessThanOrEqual(15);
      expect(normalConfig.vadEndFrames).toBeGreaterThanOrEqual(1);
      expect(normalConfig.vadEndFrames).toBeLessThanOrEqual(15);
      expect(preciseConfig.vadStartFrames).toBeGreaterThanOrEqual(1);
      expect(preciseConfig.vadStartFrames).toBeLessThanOrEqual(15);
      expect(preciseConfig.vadEndFrames).toBeGreaterThanOrEqual(1);
      expect(preciseConfig.vadEndFrames).toBeLessThanOrEqual(15);
    });

    it("Speech END 延遲應該在合理範圍內（200ms-1000ms）", () => {
      const normalDelayMs = normalConfig.vadEndFrames * 100;
      const preciseDelayMs = preciseConfig.vadEndFrames * 100;
      expect(normalDelayMs).toBeGreaterThanOrEqual(200);
      expect(normalDelayMs).toBeLessThanOrEqual(1000);
      expect(preciseDelayMs).toBeGreaterThanOrEqual(200);
      expect(preciseDelayMs).toBeLessThanOrEqual(1000);
    });
  });
});
