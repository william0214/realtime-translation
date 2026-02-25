/**
 * 語言選擇功能測試
 * 驗證使用者選擇的目標語言是否被正確使用
 */

import { describe, it, expect } from "vitest";
import { determineDirection } from "./translationService";

describe("Language Selection Feature", () => {
  describe("User selects English as target language", () => {
    it("should translate Chinese to English when user selects English", () => {
      const result = determineDirection("zh", "en", "你好");
      expect(result.direction).toBe("nurse_to_patient");
      expect(result.sourceLang).toBe("zh");
      expect(result.targetLang).toBe("en"); // ❌ 目前會是 "vi"
    });

    it("should translate Vietnamese to English when user selects English", () => {
      const result = determineDirection("vi", "en", "xin chào");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("vi");
      expect(result.targetLang).toBe("en"); // ❌ 目前會是 "zh"
    });

    it("should translate Indonesian to English when user selects English", () => {
      const result = determineDirection("id", "en", "halo");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("id");
      expect(result.targetLang).toBe("en"); // ❌ 目前會是 "zh"
    });

    it("should translate Filipino to English when user selects English", () => {
      const result = determineDirection("tl", "en", "kumusta");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("tl");
      expect(result.targetLang).toBe("en"); // ❌ 目前會是 "zh"
    });
  });

  describe("User selects Vietnamese as target language", () => {
    it("should translate Chinese to Vietnamese when user selects Vietnamese", () => {
      const result = determineDirection("zh", "vi", "你好");
      expect(result.direction).toBe("nurse_to_patient");
      expect(result.sourceLang).toBe("zh");
      expect(result.targetLang).toBe("vi"); // ✅ 這個應該已經正確
    });

    it("should translate English to Vietnamese when user selects Vietnamese", () => {
      const result = determineDirection("en", "vi", "hello");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("en");
      expect(result.targetLang).toBe("vi"); // ❌ 目前會是 "zh"
    });
  });

  describe("User selects Indonesian as target language", () => {
    it("should translate Chinese to Indonesian when user selects Indonesian", () => {
      const result = determineDirection("zh", "id", "你好");
      expect(result.direction).toBe("nurse_to_patient");
      expect(result.sourceLang).toBe("zh");
      expect(result.targetLang).toBe("id"); // ❌ 目前會是 "vi"
    });

    it("should translate Vietnamese to Indonesian when user selects Indonesian", () => {
      const result = determineDirection("vi", "id", "xin chào");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("vi");
      expect(result.targetLang).toBe("id"); // ❌ 目前會是 "zh"
    });
  });

  describe("No user preference (default behavior)", () => {
    it("should default to Vietnamese when translating Chinese without preference", () => {
      const result = determineDirection("zh", undefined, "你好");
      expect(result.direction).toBe("nurse_to_patient");
      expect(result.sourceLang).toBe("zh");
      expect(result.targetLang).toBe("vi"); // ✅ 預設越南文
    });

    it("should default to Chinese when translating Vietnamese without preference", () => {
      const result = determineDirection("vi", undefined, "xin chào");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("vi");
      expect(result.targetLang).toBe("zh"); // ✅ 預設中文
    });

    it("should default to Chinese when translating English without preference", () => {
      const result = determineDirection("en", undefined, "hello");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("en");
      expect(result.targetLang).toBe("zh"); // ✅ 預設中文
    });
  });

  describe("Edge cases", () => {
    it("should respect user preference even when Whisper detects unknown language", () => {
      const result = determineDirection("unknown", "en", "some text");
      expect(result.targetLang).toBe("en"); // ❌ 目前會是 "vi"
    });

    it("should respect user preference for all supported languages", () => {
      const supportedLanguages = ["en", "vi", "id", "tl", "it", "ja", "ko", "th"];
      
      supportedLanguages.forEach((targetLang) => {
        const result = determineDirection("zh", targetLang, "你好");
        expect(result.targetLang).toBe(targetLang);
      });
    });
  });
});
