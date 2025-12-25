/**
 * Data Flow Pollution Tests for Home.tsx
 * 
 * Tests the detectWhisperHallucination function to ensure it correctly filters:
 * 1. Prompt/Context leaks (e.g., "context: ...", "### ...", "User is speaking...")
 * 2. Language name detection output (e.g., "Chinese, Vietnamese, English")
 * 3. Repeated patterns (e.g., "謝謝,謝謝,謝謝...")
 * 4. Known hallucination phrases (e.g., "本期視頻拍到這裡")
 * 5. Edge cases and real-world examples
 */

import { describe, it, expect } from "vitest";

/**
 * Copy of detectWhisperHallucination function from Home.tsx
 * This is a pure function with no dependencies, so we can test it directly
 */
function detectWhisperHallucination(text: string): boolean {
  if (!text || text.trim() === "") {
    return true;
  }

  // 🆕 Pattern 1: Known hallucination phrases (YouTube, Podcast, Amara subtitles)
  const knownHallucinationPhrases = [
    "請不吝點贊",
    "訂閱轉發",
    "打賞支持",
    "明鏡與點點欄目",
    "本期視頻拍到這裡",
    "Amara",
    "字幕",
    "Thank you for watching",
    "Don't forget to subscribe",
    "like and subscribe",
  ];
  for (const phrase of knownHallucinationPhrases) {
    if (text.includes(phrase)) {
      return true;
    }
  }

  // 🆕 Pattern 2: Repeated short patterns (e.g., "謝謝,謝謝,謝謝..." or "Ch-Ch-Ch-Ch...")
  const repeatedPatterns = [
    /(.{1,5})[,，]\1[,，]\1/, // Repeated 1-5 char patterns with comma (e.g., "謝謝,謝謝,謝謝")
    /(.{1,3})-\1-\1/,          // Repeated 1-3 char patterns with dash (e.g., "Ch-Ch-Ch" or "Ah-Ah-Ah")
  ];
  for (const pattern of repeatedPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // 🆕 Pattern 3: Single repeated character (e.g., "AAAAA", "嗯嗯嗯嗯嗯")
  if (/^(.)\1{4,}$/.test(text)) {
    return true;
  }

  // 🆕 Pattern 4: Prompt/Context leak detection
  const promptLeakPatterns = [
    /^context:/i,              // Prompt/context leak: "context: ..."
    /^###/i,                   // Markdown header leak: "### ..."
    /User is speaking/i,       // Prompt leak: "User is speaking..."
    /Prioritize.*detection/i,  // Prompt leak: "Prioritize Chinese detection"
  ];
  for (const pattern of promptLeakPatterns) {
    if (pattern.test(text)) {
      console.warn(`[Whisper Hallucination] Detected prompt/context leak: "${text}"`);
      return true;
    }
  }

  // 🆕 Pattern 5: Non-transcription output (language detection, speaker description, audio description)
  const nonTranscriptionPatterns = [
    /Speaker likely speaks/i,
    /The speaker is/i,
    /This audio/i,
    /說話者可能說/i, // Chinese: "Speaker likely speaks"
    /這段音頻/i, // Chinese: "This audio"
  ];
  for (const pattern of nonTranscriptionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // 🆕 Pattern 6: Very short text with multiple language names (e.g., "Chinese, Vietnamese, English, Indonesian")
  if (text.length < 100) {
    const languageNames = [
      "Chinese", "Vietnamese", "English", "Indonesian", "Filipino", "Thai", "Japanese", "Korean",
      "中文", "越南語", "英語", "印尼語", "菲律賓語", "泰語", "日語", "韓語",
    ];
    let languageCount = 0;
    for (const lang of languageNames) {
      if (text.includes(lang)) {
        languageCount++;
      }
    }
    // If text contains 3+ language names, it's likely a language detection output
    if (languageCount >= 3) {
      return true;
    }
  }

  return false;
}

describe("Data Flow Pollution: Prompt/Context Leak", () => {
  it("should detect 'context:' prefix", () => {
    expect(detectWhisperHallucination("context: User is speaking Chinese")).toBe(true);
    expect(detectWhisperHallucination("Context: Some information")).toBe(true);
  });

  it("should detect '###' markdown header", () => {
    expect(detectWhisperHallucination("### User is speaking")).toBe(true);
    expect(detectWhisperHallucination("### Section Title")).toBe(true);
  });

  it("should detect 'User is speaking' prompt leak", () => {
    expect(detectWhisperHallucination("User is speaking Chinese")).toBe(true);
    expect(detectWhisperHallucination("The user is speaking Vietnamese")).toBe(true);
  });

  it("should detect 'Prioritize detection' prompt leak", () => {
    expect(detectWhisperHallucination("Prioritize Chinese detection")).toBe(true);
    expect(detectWhisperHallucination("Prioritize Vietnamese detection")).toBe(true);
  });

  it("should detect 'Speaker likely speaks' language detection output", () => {
    expect(detectWhisperHallucination("Speaker likely speaks Chinese")).toBe(true);
    expect(detectWhisperHallucination("The speaker likely speaks Vietnamese")).toBe(true);
  });

  it("should detect 'The speaker is' description", () => {
    expect(detectWhisperHallucination("The speaker is speaking Chinese")).toBe(true);
    expect(detectWhisperHallucination("The speaker is a native Vietnamese speaker")).toBe(true);
  });

  it("should detect 'This audio' description", () => {
    expect(detectWhisperHallucination("This audio contains Chinese speech")).toBe(true);
    expect(detectWhisperHallucination("This audio is in Vietnamese")).toBe(true);
  });

  it("should NOT detect normal Chinese speech", () => {
    expect(detectWhisperHallucination("你好，請問有什麼可以幫助你的嗎？")).toBe(false);
    expect(detectWhisperHallucination("我需要看醫生")).toBe(false);
  });

  it("should NOT detect normal Vietnamese speech", () => {
    expect(detectWhisperHallucination("Xin chào, tôi cần giúp đỡ")).toBe(false);
    expect(detectWhisperHallucination("Tôi bị đau đầu")).toBe(false);
  });

  it("should NOT detect normal English speech", () => {
    expect(detectWhisperHallucination("Hello, how can I help you?")).toBe(false);
    expect(detectWhisperHallucination("I need to see a doctor")).toBe(false);
  });
});

describe("Data Flow Pollution: Language Name Detection", () => {
  it("should detect text with 3+ language names", () => {
    expect(detectWhisperHallucination("Chinese, Vietnamese, English, Indonesian")).toBe(true);
    expect(detectWhisperHallucination("中文、越南語、英語")).toBe(true);
  });

  it("should NOT detect text with 1-2 language names", () => {
    expect(detectWhisperHallucination("I speak Chinese")).toBe(false);
    expect(detectWhisperHallucination("我會說中文和英語")).toBe(false);
  });

  it("should NOT detect long text with 3+ language names", () => {
    const longText = "我是一名翻譯員，我會說中文、越南語和英語。我在醫院工作，幫助病人和醫生溝通。這是我的工作內容。我每天都會接觸到來自不同國家的病人，他們可能說不同的語言，但我都能幫助他們與醫生溝通。這個工作非常有意義，讓我能夠幫助更多人。";
    expect(detectWhisperHallucination(longText)).toBe(false);
  });

  it("should detect short language list (< 100 chars)", () => {
    expect(detectWhisperHallucination("Languages: Chinese, Vietnamese, English")).toBe(true);
  });
});

describe("Data Flow Pollution: Repeated Patterns", () => {
  it("should detect repeated short patterns with comma", () => {
    expect(detectWhisperHallucination("謝謝,謝謝,謝謝")).toBe(true);
    expect(detectWhisperHallucination("Hello,Hello,Hello,Hello")).toBe(true);
  });

  it("should detect repeated short patterns with dash", () => {
    expect(detectWhisperHallucination("Ch-Ch-Ch-Ch")).toBe(true);
    expect(detectWhisperHallucination("Ah-Ah-Ah")).toBe(true);
  });

  it("should detect single repeated character", () => {
    expect(detectWhisperHallucination("AAAAA")).toBe(true);
    expect(detectWhisperHallucination("嗯嗯嗯嗯嗯")).toBe(true);
  });

  it("should NOT detect normal repeated words in sentence", () => {
    expect(detectWhisperHallucination("謝謝你的幫助")).toBe(false);
    expect(detectWhisperHallucination("Hello, hello, how are you?")).toBe(false);
  });
});

describe("Data Flow Pollution: Known Hallucination Phrases", () => {
  it("should detect YouTube-style phrases", () => {
    expect(detectWhisperHallucination("本期視頻拍到這裡")).toBe(true);
    expect(detectWhisperHallucination("請不吝點贊訂閱轉發")).toBe(true);
  });

  it("should detect Amara subtitle markers", () => {
    expect(detectWhisperHallucination("Amara字幕")).toBe(true);
    expect(detectWhisperHallucination("由Amara提供字幕")).toBe(true);
  });

  it("should detect English YouTube phrases", () => {
    expect(detectWhisperHallucination("Thank you for watching")).toBe(true);
    expect(detectWhisperHallucination("Don't forget to like and subscribe")).toBe(true);
  });

  it("should NOT detect partial matches in normal speech", () => {
    expect(detectWhisperHallucination("謝謝你的幫助")).toBe(false);
    expect(detectWhisperHallucination("Thank you for your help")).toBe(false);
  });

  it("should NOT detect normal speech with similar words", () => {
    expect(detectWhisperHallucination("我在看視頻學習")).toBe(false);
    expect(detectWhisperHallucination("請幫我訂閱這個服務")).toBe(false);
  });
});

describe("Data Flow Pollution: Edge Cases", () => {
  it("should detect empty or whitespace-only text", () => {
    expect(detectWhisperHallucination("")).toBe(true);
    expect(detectWhisperHallucination("   ")).toBe(true);
    expect(detectWhisperHallucination("\n\t")).toBe(true);
  });

  it("should handle null/undefined gracefully", () => {
    expect(detectWhisperHallucination(null as any)).toBe(true);
    expect(detectWhisperHallucination(undefined as any)).toBe(true);
  });

  it("should NOT detect very short normal speech", () => {
    expect(detectWhisperHallucination("好")).toBe(false);
    expect(detectWhisperHallucination("OK")).toBe(false);
    expect(detectWhisperHallucination("是")).toBe(false);
  });

  it("should NOT detect numbers or dates", () => {
    expect(detectWhisperHallucination("2024-01-25")).toBe(false);
    expect(detectWhisperHallucination("12345")).toBe(false);
  });

  it("should NOT detect normal punctuation", () => {
    expect(detectWhisperHallucination("你好！")).toBe(false);
    expect(detectWhisperHallucination("What?")).toBe(false);
  });
});

describe("Data Flow Pollution: Real-World Examples", () => {
  it("should detect real prompt leak from logs", () => {
    expect(detectWhisperHallucination("context: ### User is speaking Chinese")).toBe(true);
  });

  it("should detect real language detection output", () => {
    expect(detectWhisperHallucination("Speaker likely speaks Chinese, Vietnamese, or English")).toBe(true);
  });

  it("should NOT detect real medical dialogue (Chinese)", () => {
    expect(detectWhisperHallucination("我頭痛，需要看醫生")).toBe(false);
    expect(detectWhisperHallucination("請問你哪裡不舒服？")).toBe(false);
  });

  it("should NOT detect real medical dialogue (Vietnamese)", () => {
    expect(detectWhisperHallucination("Tôi bị đau bụng")).toBe(false);
    expect(detectWhisperHallucination("Bạn cảm thấy thế nào?")).toBe(false);
  });

  it("should NOT detect real medical dialogue (English)", () => {
    expect(detectWhisperHallucination("I have a headache")).toBe(false);
    expect(detectWhisperHallucination("Where does it hurt?")).toBe(false);
  });
});
