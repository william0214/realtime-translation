import { describe, expect, it } from "vitest";
import { determineDirection, translateText } from "./translationService";

describe("Translation Service", () => {
  describe("determineDirection", () => {
    it("should identify Chinese as nurse language", () => {
      const result = determineDirection("zh");
      expect(result.direction).toBe("nurse_to_patient");
      expect(result.sourceLang).toBe("zh");
      expect(result.targetLang).toBe("vi");
    });

    it("should identify Vietnamese as patient language", () => {
      const result = determineDirection("vi");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("vi");
      expect(result.targetLang).toBe("zh");
    });

    it("should identify English as patient language", () => {
      const result = determineDirection("en");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("en");
      expect(result.targetLang).toBe("zh");
    });

    it("should identify Indonesian as patient language", () => {
      const result = determineDirection("id");
      expect(result.direction).toBe("patient_to_nurse");
      expect(result.sourceLang).toBe("id");
      expect(result.targetLang).toBe("zh");
    });
  });

  describe("translateText", () => {
    it("should translate Chinese to Vietnamese", async () => {
      const result = await translateText("你好", "zh", "vi");
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(typeof result).toBe("string");
    }, 30000);

    it("should translate Vietnamese to Chinese", async () => {
      const result = await translateText("Xin chào", "vi", "zh");
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(typeof result).toBe("string");
    }, 30000);

    it("should translate English to Chinese", async () => {
      const result = await translateText("Hello", "en", "zh");
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(typeof result).toBe("string");
    }, 30000);
  });
});
