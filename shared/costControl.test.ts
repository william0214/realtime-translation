import { describe, expect, it } from "vitest";
import { shouldRunQualityPass, calculateCostControlStats } from "./costControl";

describe("shouldRunQualityPass", () => {
  describe("Short sentence blacklist", () => {
    it("should skip Quality Pass for common short responses", () => {
      expect(shouldRunQualityPass("好", "zh")).toBe(false);
      expect(shouldRunQualityPass("對", "zh")).toBe(false);
      expect(shouldRunQualityPass("是", "zh")).toBe(false);
      expect(shouldRunQualityPass("嗯", "zh")).toBe(false);
      expect(shouldRunQualityPass("謝謝", "zh")).toBe(false);
      expect(shouldRunQualityPass("可以", "zh")).toBe(false);
      expect(shouldRunQualityPass("知道了", "zh")).toBe(false);
    });

    it("should skip Quality Pass for short sentences with punctuation", () => {
      expect(shouldRunQualityPass("好。", "zh")).toBe(false);
      expect(shouldRunQualityPass("謝謝！", "zh")).toBe(false);
      expect(shouldRunQualityPass("可以。", "zh")).toBe(false);
    });
  });

  describe("Length-based filtering", () => {
    it("should skip Quality Pass for very short sentences (< 5 chars)", () => {
      expect(shouldRunQualityPass("啊", "zh")).toBe(false);
      expect(shouldRunQualityPass("喔", "zh")).toBe(false);
      expect(shouldRunQualityPass("欸", "zh")).toBe(false);
      expect(shouldRunQualityPass("等等", "zh")).toBe(false);
    });

    it("should run Quality Pass for long sentences (≥ 12 chars)", () => {
      expect(shouldRunQualityPass("我今天早上起床後覺得有點不舒服", "zh")).toBe(true);
      expect(shouldRunQualityPass("請問我需要吃什麼藥物來緩解症狀", "zh")).toBe(true);
      expect(shouldRunQualityPass("我的血壓最近一直很高需要調整藥物嗎", "zh")).toBe(true);
    });
  });

  describe("Medical keyword detection", () => {
    it("should run Quality Pass for vital signs", () => {
      expect(shouldRunQualityPass("我頭很痛", "zh")).toBe(true);
      expect(shouldRunQualityPass("有點發燒", "zh")).toBe(true);
      expect(shouldRunQualityPass("血壓高", "zh")).toBe(true);
      expect(shouldRunQualityPass("心跳快", "zh")).toBe(true);
      expect(shouldRunQualityPass("血氧低", "zh")).toBe(true);
    });

    it("should run Quality Pass for medications", () => {
      expect(shouldRunQualityPass("需要吃藥嗎", "zh")).toBe(true);
      expect(shouldRunQualityPass("劑量多少", "zh")).toBe(true);
      expect(shouldRunQualityPass("有止痛藥嗎", "zh")).toBe(true);
      expect(shouldRunQualityPass("抗生素", "zh")).toBe(true);
    });

    it("should run Quality Pass for symptoms", () => {
      expect(shouldRunQualityPass("有點嘔心", "zh")).toBe(true);
      expect(shouldRunQualityPass("有點頭暈", "zh")).toBe(true); // 加上前綴使長度 > 3
      expect(shouldRunQualityPass("有點嘔吐", "zh")).toBe(true); // 加上前綴使長度 > 3
      expect(shouldRunQualityPass("一直咳嗽", "zh")).toBe(true); // 加上前綴使長度 > 3
    });

    it("should run Quality Pass for medical procedures", () => {
      expect(shouldRunQualityPass("要打針嗎", "zh")).toBe(true);
      expect(shouldRunQualityPass("需要抽血", "zh")).toBe(true);
      expect(shouldRunQualityPass("做檢查", "zh")).toBe(true);
    });

    it("should run Quality Pass for diseases", () => {
      expect(shouldRunQualityPass("有糖尿病", "zh")).toBe(true);
      expect(shouldRunQualityPass("有高血壓", "zh")).toBe(true); // 加上前綴使長度 > 3
      expect(shouldRunQualityPass("有心臟病", "zh")).toBe(true); // 加上前綴使長度 > 3
      expect(shouldRunQualityPass("有過敏", "zh")).toBe(true); // 加上前綴使長度 > 3
    });
  });

  describe("Number and unit detection", () => {
    it("should run Quality Pass for numbers", () => {
      expect(shouldRunQualityPass("體溫38度", "zh")).toBe(true);
      expect(shouldRunQualityPass("血壓120/80", "zh")).toBe(true);
      expect(shouldRunQualityPass("吃2顆", "zh")).toBe(true);
    });

    it("should run Quality Pass for units", () => {
      expect(shouldRunQualityPass("500mg", "zh")).toBe(true);
      expect(shouldRunQualityPass("10ml", "zh")).toBe(true);
      expect(shouldRunQualityPass("38.5℃", "zh")).toBe(true);
      expect(shouldRunQualityPass("120mmHg", "zh")).toBe(true);
      expect(shouldRunQualityPass("每天3次", "zh")).toBe(true);
    });

    it("should run Quality Pass for time-related expressions", () => {
      expect(shouldRunQualityPass("吃3天", "zh")).toBe(true);
      expect(shouldRunQualityPass("2週後回診", "zh")).toBe(true);
      expect(shouldRunQualityPass("每天早晚各1次", "zh")).toBe(true);
    });
  });

  describe("Negation detection", () => {
    it("should run Quality Pass for negations (critical for medical accuracy)", () => {
      expect(shouldRunQualityPass("我不痛", "zh")).toBe(true); // 加上前綴使長度 > 3
      expect(shouldRunQualityPass("沒有發燒", "zh")).toBe(true);
      expect(shouldRunQualityPass("未服用藥物", "zh")).toBe(true);
      expect(shouldRunQualityPass("別擔心", "zh")).toBe(true);
      expect(shouldRunQualityPass("無過敏", "zh")).toBe(true);
    });

    it("should run Quality Pass for double negations", () => {
      expect(shouldRunQualityPass("不是不痛", "zh")).toBe(true);
      expect(shouldRunQualityPass("沒有不舒服", "zh")).toBe(true);
    });
  });

  describe("Non-Chinese text", () => {
    it("should always run Quality Pass for non-Chinese text (to be safe)", () => {
      expect(shouldRunQualityPass("Hello", "en")).toBe(true);
      expect(shouldRunQualityPass("Xin chào", "vi")).toBe(true);
      expect(shouldRunQualityPass("こんにちは", "ja")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty strings", () => {
      expect(shouldRunQualityPass("", "zh")).toBe(false);
    });

    it("should handle strings with only punctuation", () => {
      expect(shouldRunQualityPass("。。。", "zh")).toBe(false);
      expect(shouldRunQualityPass("！？", "zh")).toBe(false);
    });

    it("should handle strings with spaces", () => {
      expect(shouldRunQualityPass("  好  ", "zh")).toBe(false);
      expect(shouldRunQualityPass("  我 頭 很 痛  ", "zh")).toBe(true);
    });
  });

  describe("Real-world medical scenarios", () => {
    it("should handle typical nurse-patient conversations", () => {
      // Nurse asks about pain
      expect(shouldRunQualityPass("你哪裡痛？", "zh")).toBe(true);
      
      // Patient responds with location
      expect(shouldRunQualityPass("肚子痛", "zh")).toBe(true);
      
      // Nurse asks about severity
      expect(shouldRunQualityPass("痛多久了？", "zh")).toBe(true);
      
      // Patient responds with duration
      expect(shouldRunQualityPass("2天了", "zh")).toBe(true);
      
      // Nurse asks about medication
      expect(shouldRunQualityPass("有吃藥嗎？", "zh")).toBe(true);
      
      // Patient responds negatively (critical negation)
      expect(shouldRunQualityPass("沒有痛", "zh")).toBe(true); // 加上後綴使長度 > 3
      
      // Nurse provides instructions
      expect(shouldRunQualityPass("等一下打針", "zh")).toBe(true);
      
      // Patient acknowledges (short response)
      expect(shouldRunQualityPass("好", "zh")).toBe(false);
    });

    it("should handle medication instructions", () => {
      expect(shouldRunQualityPass("每天吃3次，每次2顆，飯後服用", "zh")).toBe(true);
      expect(shouldRunQualityPass("止痛藥500mg，每6小時1次", "zh")).toBe(true);
      expect(shouldRunQualityPass("如果發燒超過38.5度就吃退燒藥", "zh")).toBe(true);
    });

    it("should handle allergy questions", () => {
      expect(shouldRunQualityPass("有沒有藥物過敏？", "zh")).toBe(true);
      expect(shouldRunQualityPass("對青黴素過敏", "zh")).toBe(true);
      expect(shouldRunQualityPass("沒有過敏", "zh")).toBe(true);
    });
  });
});

describe("calculateCostControlStats", () => {
  it("should calculate correct statistics", () => {
    const stats = calculateCostControlStats(100, 60);
    
    expect(stats.totalSentences).toBe(100);
    expect(stats.qualityPassRun).toBe(60);
    expect(stats.qualityPassSkipped).toBe(40);
    expect(stats.qualityPassRate).toBe(60);
    expect(stats.costSavings).toBe(40);
  });

  it("should handle zero sentences", () => {
    const stats = calculateCostControlStats(0, 0);
    
    expect(stats.totalSentences).toBe(0);
    expect(stats.qualityPassRun).toBe(0);
    expect(stats.qualityPassSkipped).toBe(0);
    expect(stats.qualityPassRate).toBe(0);
    expect(stats.costSavings).toBe(0);
  });

  it("should handle 100% Quality Pass rate", () => {
    const stats = calculateCostControlStats(100, 100);
    
    expect(stats.totalSentences).toBe(100);
    expect(stats.qualityPassRun).toBe(100);
    expect(stats.qualityPassSkipped).toBe(0);
    expect(stats.qualityPassRate).toBe(100);
    expect(stats.costSavings).toBe(0);
  });

  it("should handle 0% Quality Pass rate", () => {
    const stats = calculateCostControlStats(100, 0);
    
    expect(stats.totalSentences).toBe(100);
    expect(stats.qualityPassRun).toBe(0);
    expect(stats.qualityPassSkipped).toBe(100);
    expect(stats.qualityPassRate).toBe(0);
    expect(stats.costSavings).toBe(100);
  });
});
