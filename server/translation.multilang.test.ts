import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import fs from "fs";
import path from "path";

/**
 * 多語言翻譯單元測試
 * 
 * 測試系統對不同語言的翻譯能力：
 * - 越南語 (Vietnamese)
 * - 印尼語 (Indonesian)
 * - 菲律賓語 (Filipino)
 * - 英文 (English)
 * - 日文 (Japanese)
 * - 韓文 (Korean)
 * - 泰文 (Thai)
 * - 義大利語 (Italian)
 * 
 * 測試方法：
 * 1. 使用預錄的中文音檔（"你好，請問需要什麼幫助？"）
 * 2. 分別翻譯成各種目標語言
 * 3. 驗證翻譯結果包含預期的關鍵字
 */

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/**
 * 讀取測試音檔並轉換為 Base64
 * 
 * 注意：這個測試需要一個真實的中文音檔
 * 如果沒有音檔，測試會被跳過
 */
function getTestAudioBase64(): string | null {
  const testAudioPath = path.join(__dirname, "../test-audio/chinese-sample.webm");
  
  if (!fs.existsSync(testAudioPath)) {
    console.warn(`⚠️ Test audio file not found: ${testAudioPath}`);
    console.warn("⚠️ Please create a test audio file with Chinese speech: '你好，請問需要什麼幫助？'");
    return null;
  }

  const audioBuffer = fs.readFileSync(testAudioPath);
  return audioBuffer.toString("base64");
}

describe("多語言翻譯測試", () => {
  const ctx = createAuthContext();
  const caller = appRouter.createCaller(ctx);
  const audioBase64 = getTestAudioBase64();

  // 如果沒有測試音檔，跳過所有測試
  if (!audioBase64) {
    it.skip("需要測試音檔才能執行翻譯測試", () => {});
    return;
  }

  /**
   * 測試越南語翻譯
   * 預期關鍵字：xin chào, giúp (你好、幫助)
   */
  it("應該正確翻譯成越南語", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-vietnamese.webm",
      preferredTargetLang: "Vietnamese",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("Vietnamese");
    
    // 驗證翻譯結果包含越南語關鍵字（不區分大小寫）
    const translatedLower = result.translatedText!.toLowerCase();
    const hasGreeting = translatedLower.includes("xin chào") || translatedLower.includes("chào");
    const hasHelp = translatedLower.includes("giúp") || translatedLower.includes("trợ giúp");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 越南語翻譯: ${result.translatedText}`);
  }, 15000); // 15 秒超時

  /**
   * 測試印尼語翻譯
   * 預期關鍵字：halo, bantuan (你好、幫助)
   */
  it("應該正確翻譯成印尼語", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-indonesian.webm",
      preferredTargetLang: "Indonesian",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("Indonesian");
    
    const translatedLower = result.translatedText!.toLowerCase();
    const hasGreeting = translatedLower.includes("halo") || translatedLower.includes("hai");
    const hasHelp = translatedLower.includes("bantuan") || translatedLower.includes("membantu");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 印尼語翻譯: ${result.translatedText}`);
  }, 15000);

  /**
   * 測試菲律賓語翻譯
   * 預期關鍵字：kumusta, tulong (你好、幫助)
   */
  it("應該正確翻譯成菲律賓語", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-filipino.webm",
      preferredTargetLang: "Filipino",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("Filipino");
    
    const translatedLower = result.translatedText!.toLowerCase();
    const hasGreeting = translatedLower.includes("kumusta") || translatedLower.includes("hello");
    const hasHelp = translatedLower.includes("tulong") || translatedLower.includes("help");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 菲律賓語翻譯: ${result.translatedText}`);
  }, 15000);

  /**
   * 測試英文翻譯
   * 預期關鍵字：hello, help
   */
  it("應該正確翻譯成英文", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-english.webm",
      preferredTargetLang: "English",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("English");
    
    const translatedLower = result.translatedText!.toLowerCase();
    const hasGreeting = translatedLower.includes("hello") || translatedLower.includes("hi");
    const hasHelp = translatedLower.includes("help") || translatedLower.includes("assist");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 英文翻譯: ${result.translatedText}`);
  }, 15000);

  /**
   * 測試日文翻譯
   * 預期關鍵字：こんにちは、お手伝い (你好、幫助)
   */
  it("應該正確翻譯成日文", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-japanese.webm",
      preferredTargetLang: "Japanese",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("Japanese");
    
    const translated = result.translatedText!;
    const hasGreeting = translated.includes("こんにちは") || translated.includes("もしもし");
    const hasHelp = translated.includes("お手伝い") || translated.includes("助け") || translated.includes("サポート");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 日文翻譯: ${result.translatedText}`);
  }, 15000);

  /**
   * 測試韓文翻譯
   * 預期關鍵字：안녕하세요、도움 (你好、幫助)
   */
  it("應該正確翻譯成韓文", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-korean.webm",
      preferredTargetLang: "Korean",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("Korean");
    
    const translated = result.translatedText!;
    const hasGreeting = translated.includes("안녕하세요") || translated.includes("안녕");
    const hasHelp = translated.includes("도움") || translated.includes("도와");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 韓文翻譯: ${result.translatedText}`);
  }, 15000);

  /**
   * 測試泰文翻譯
   * 預期關鍵字：สวัสดี、ช่วย (你好、幫助)
   */
  it("應該正確翻譯成泰文", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-thai.webm",
      preferredTargetLang: "Thai",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("Thai");
    
    const translated = result.translatedText!;
    const hasGreeting = translated.includes("สวัสดี") || translated.includes("หวัดดี");
    const hasHelp = translated.includes("ช่วย") || translated.includes("ช่วยเหลือ");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 泰文翻譯: ${result.translatedText}`);
  }, 15000);

  /**
   * 測試義大利語翻譯
   * 預期關鍵字：ciao, aiuto (你好、幫助)
   */
  it("應該正確翻譯成義大利語", async () => {
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-italian.webm",
      preferredTargetLang: "Italian",
      asrMode: "normal",
    });

    expect(result.success).toBe(true);
    expect(result.sourceText).toBeTruthy();
    expect(result.translatedText).toBeTruthy();
    expect(result.targetLang).toBe("Italian");
    
    const translatedLower = result.translatedText!.toLowerCase();
    const hasGreeting = translatedLower.includes("ciao") || translatedLower.includes("salve");
    const hasHelp = translatedLower.includes("aiuto") || translatedLower.includes("aiutare");
    
    expect(hasGreeting || hasHelp).toBe(true);
    console.log(`✅ 義大利語翻譯: ${result.translatedText}`);
  }, 15000);
});

/**
 * 效能測試
 * 驗證翻譯速度在可接受範圍內
 */
describe("翻譯效能測試", () => {
  const ctx = createAuthContext();
  const caller = appRouter.createCaller(ctx);
  const audioBase64 = getTestAudioBase64();

  if (!audioBase64) {
    it.skip("需要測試音檔才能執行效能測試", () => {});
    return;
  }

  it("翻譯速度應該在 10 秒內完成", async () => {
    const startTime = Date.now();
    
    const result = await caller.translation.translateAudio({
      audioBase64,
      filename: "test-performance.webm",
      preferredTargetLang: "Vietnamese",
      asrMode: "normal",
    });

    const duration = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(10000); // 應該在 10 秒內完成
    
    console.log(`⏱️ 翻譯耗時: ${(duration / 1000).toFixed(2)} 秒`);
  }, 15000);
});
