/**
 * 翻譯狀態機單元測試
 * 
 * 驗證兩段式翻譯的狀態流轉：
 * - 成功路徑: pending → processing → completed
 * - 失敗路徑: pending → processing → failed
 * - 跳過路徑: pending → skipped
 */

import { describe, expect, it } from "vitest";

type TranslationStage = "provisional" | "final";
type QualityPassStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

interface TranslationState {
  translationStage: TranslationStage;
  qualityPassStatus: QualityPassStatus;
}

/**
 * 驗證狀態轉換是否合法
 */
function isValidTransition(from: TranslationState, to: TranslationState): boolean {
  // pending → processing
  if (
    from.translationStage === "provisional" &&
    from.qualityPassStatus === "pending" &&
    to.translationStage === "provisional" &&
    to.qualityPassStatus === "processing"
  ) {
    return true;
  }

  // processing → completed (成功)
  if (
    from.translationStage === "provisional" &&
    from.qualityPassStatus === "processing" &&
    to.translationStage === "final" &&
    to.qualityPassStatus === "completed"
  ) {
    return true;
  }

  // processing → failed (失敗，保持 provisional)
  if (
    from.translationStage === "provisional" &&
    from.qualityPassStatus === "processing" &&
    to.translationStage === "provisional" &&
    to.qualityPassStatus === "failed"
  ) {
    return true;
  }

  // pending → skipped (短句跳過)
  if (
    from.translationStage === "provisional" &&
    from.qualityPassStatus === "pending" &&
    to.translationStage === "final" &&
    to.qualityPassStatus === "skipped"
  ) {
    return true;
  }

  return false;
}

describe("Translation State Machine", () => {
  describe("Valid Transitions", () => {
    it("should allow pending → processing", () => {
      const from: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "pending",
      };
      const to: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "processing",
      };
      expect(isValidTransition(from, to)).toBe(true);
    });

    it("should allow processing → completed (success path)", () => {
      const from: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "processing",
      };
      const to: TranslationState = {
        translationStage: "final",
        qualityPassStatus: "completed",
      };
      expect(isValidTransition(from, to)).toBe(true);
    });

    it("should allow processing → failed (failure path)", () => {
      const from: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "processing",
      };
      const to: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "failed",
      };
      expect(isValidTransition(from, to)).toBe(true);
    });

    it("should allow pending → skipped (short sentence path)", () => {
      const from: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "pending",
      };
      const to: TranslationState = {
        translationStage: "final",
        qualityPassStatus: "skipped",
      };
      expect(isValidTransition(from, to)).toBe(true);
    });
  });

  describe("Invalid Transitions", () => {
    it("should not allow pending → completed (skipping processing)", () => {
      const from: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "pending",
      };
      const to: TranslationState = {
        translationStage: "final",
        qualityPassStatus: "completed",
      };
      expect(isValidTransition(from, to)).toBe(false);
    });

    it("should not allow pending → failed (skipping processing)", () => {
      const from: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "pending",
      };
      const to: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "failed",
      };
      expect(isValidTransition(from, to)).toBe(false);
    });

    it("should not allow completed → processing (going backward)", () => {
      const from: TranslationState = {
        translationStage: "final",
        qualityPassStatus: "completed",
      };
      const to: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "processing",
      };
      expect(isValidTransition(from, to)).toBe(false);
    });

    it("should not allow failed → processing (going backward)", () => {
      const from: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "failed",
      };
      const to: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "processing",
      };
      expect(isValidTransition(from, to)).toBe(false);
    });

    it("should not allow skipped → processing (going backward)", () => {
      const from: TranslationState = {
        translationStage: "final",
        qualityPassStatus: "skipped",
      };
      const to: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "processing",
      };
      expect(isValidTransition(from, to)).toBe(false);
    });
  });

  describe("State Machine Paths", () => {
    it("should follow success path: pending → processing → completed", () => {
      const states: TranslationState[] = [
        { translationStage: "provisional", qualityPassStatus: "pending" },
        { translationStage: "provisional", qualityPassStatus: "processing" },
        { translationStage: "final", qualityPassStatus: "completed" },
      ];

      for (let i = 0; i < states.length - 1; i++) {
        expect(isValidTransition(states[i]!, states[i + 1]!)).toBe(true);
      }
    });

    it("should follow failure path: pending → processing → failed", () => {
      const states: TranslationState[] = [
        { translationStage: "provisional", qualityPassStatus: "pending" },
        { translationStage: "provisional", qualityPassStatus: "processing" },
        { translationStage: "provisional", qualityPassStatus: "failed" },
      ];

      for (let i = 0; i < states.length - 1; i++) {
        expect(isValidTransition(states[i]!, states[i + 1]!)).toBe(true);
      }
    });

    it("should follow skip path: pending → skipped", () => {
      const states: TranslationState[] = [
        { translationStage: "provisional", qualityPassStatus: "pending" },
        { translationStage: "final", qualityPassStatus: "skipped" },
      ];

      for (let i = 0; i < states.length - 1; i++) {
        expect(isValidTransition(states[i]!, states[i + 1]!)).toBe(true);
      }
    });
  });

  describe("Terminal States", () => {
    it("should recognize completed as a terminal state", () => {
      const completedState: TranslationState = {
        translationStage: "final",
        qualityPassStatus: "completed",
      };

      // No valid transitions from completed
      const nextStates: TranslationState[] = [
        { translationStage: "provisional", qualityPassStatus: "pending" },
        { translationStage: "provisional", qualityPassStatus: "processing" },
        { translationStage: "provisional", qualityPassStatus: "failed" },
        { translationStage: "final", qualityPassStatus: "skipped" },
      ];

      nextStates.forEach((nextState) => {
        expect(isValidTransition(completedState, nextState)).toBe(false);
      });
    });

    it("should recognize failed as a terminal state", () => {
      const failedState: TranslationState = {
        translationStage: "provisional",
        qualityPassStatus: "failed",
      };

      // No valid transitions from failed
      const nextStates: TranslationState[] = [
        { translationStage: "provisional", qualityPassStatus: "pending" },
        { translationStage: "provisional", qualityPassStatus: "processing" },
        { translationStage: "final", qualityPassStatus: "completed" },
        { translationStage: "final", qualityPassStatus: "skipped" },
      ];

      nextStates.forEach((nextState) => {
        expect(isValidTransition(failedState, nextState)).toBe(false);
      });
    });

    it("should recognize skipped as a terminal state", () => {
      const skippedState: TranslationState = {
        translationStage: "final",
        qualityPassStatus: "skipped",
      };

      // No valid transitions from skipped
      const nextStates: TranslationState[] = [
        { translationStage: "provisional", qualityPassStatus: "pending" },
        { translationStage: "provisional", qualityPassStatus: "processing" },
        { translationStage: "provisional", qualityPassStatus: "failed" },
        { translationStage: "final", qualityPassStatus: "completed" },
      ];

      nextStates.forEach((nextState) => {
        expect(isValidTransition(skippedState, nextState)).toBe(false);
      });
    });
  });
});
