import { describe, expect, it } from "vitest";
import { transcribeAudio } from "./translationService";
import fs from "fs";
import path from "path";

/**
 * OpenAI ASR API 單元測試
 * 
 * 測試所有 4 個 OpenAI 語音轉文字模型：
 * 1. whisper-1 - Whisper 系列的 API 入口
 * 2. gpt-4o-mini-transcribe - 較省成本、較快的轉錄
 * 3. gpt-4o-transcribe - 較高品質轉錄
 * 4. gpt-4o-transcribe-diarize - 含說話者辨識/標記與時間資訊
 * 
 * 注意：
 * - 這些測試會實際呼叫 OpenAI API，會產生費用
 * - 需要設定 OPENAI_API_KEY 環境變數
 * - 測試音檔需要放在 test-audio 目錄下
 */

describe("OpenAI ASR API Tests", () => {
  // 測試音檔路徑（需要準備測試音檔）
  const testAudioPath = path.join(__dirname, "../test-audio/sample.webm");
  
  // 檢查測試音檔是否存在
  const hasTestAudio = fs.existsSync(testAudioPath);
  
  // 如果沒有測試音檔，跳過所有測試
  if (!hasTestAudio) {
    it.skip("No test audio file found, skipping ASR API tests", () => {
      console.log(`⚠️ Test audio file not found: ${testAudioPath}`);
      console.log("Please create a test-audio directory and add a sample.webm file");
    });
    return;
  }

  // 讀取測試音檔
  const audioBuffer = fs.readFileSync(testAudioPath);
  const filename = "test-sample.webm";

  /**
   * 測試 1: whisper-1 模型
   * 這是 Whisper 系列的 API 入口，最穩定的模型
   */
  it("should transcribe audio using whisper-1 model", async () => {
    const result = await transcribeAudio(audioBuffer, filename, "normal", "whisper-1");
    
    console.log("\n=== whisper-1 結果 ===");
    console.log("文字:", result.text);
    console.log("語言:", result.language);
    console.log("ASR 延遲:", result.asrProfile?.duration, "ms");
    
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.language).toBeTruthy();
  }, 30000); // 30 秒超時

  /**
   * 測試 2: gpt-4o-mini-transcribe 模型
   * 較省成本、較快的轉錄模型
   */
  it("should transcribe audio using gpt-4o-mini-transcribe model", async () => {
    const result = await transcribeAudio(audioBuffer, filename, "normal", "gpt-4o-mini-transcribe");
    
    console.log("\n=== gpt-4o-mini-transcribe 結果 ===");
    console.log("文字:", result.text);
    console.log("語言:", result.language);
    console.log("ASR 延遲:", result.asrProfile?.duration, "ms");
    
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.language).toBeTruthy();
  }, 30000);

  /**
   * 測試 3: gpt-4o-transcribe 模型
   * 較高品質轉錄模型
   */
  it("should transcribe audio using gpt-4o-transcribe model", async () => {
    const result = await transcribeAudio(audioBuffer, filename, "normal", "gpt-4o-transcribe");
    
    console.log("\n=== gpt-4o-transcribe 結果 ===");
    console.log("文字:", result.text);
    console.log("語言:", result.language);
    console.log("ASR 延遲:", result.asrProfile?.duration, "ms");
    
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.language).toBeTruthy();
  }, 30000);

  /**
   * 測試 4: gpt-4o-transcribe-diarize 模型
   * 含說話者辨識/標記與時間資訊
   * 注意：這個模型可能回傳不同的資料結構
   */
  it("should transcribe audio using gpt-4o-transcribe-diarize model", async () => {
    const result = await transcribeAudio(audioBuffer, filename, "normal", "gpt-4o-transcribe-diarize");
    
    console.log("\n=== gpt-4o-transcribe-diarize 結果 ===");
    console.log("文字:", result.text);
    console.log("語言:", result.language);
    console.log("ASR 延遲:", result.asrProfile?.duration, "ms");
    
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
    // diarize 模型可能不回傳 language，所以不強制要求
  }, 30000);

  /**
   * 測試 5: 比較所有模型的效能
   * 測量每個模型的轉錄時間和準確度
   */
  it("should compare performance of all ASR models", async () => {
    const models = [
      "whisper-1",
      "gpt-4o-mini-transcribe",
      "gpt-4o-transcribe",
      "gpt-4o-transcribe-diarize",
    ];

    const results: Array<{
      model: string;
      text: string;
      language: string | undefined;
      duration: number;
    }> = [];

    console.log("\n=== 效能比較 ===");
    
    for (const model of models) {
      const startTime = Date.now();
      const result = await transcribeAudio(audioBuffer, filename, "normal", model);
      const duration = Date.now() - startTime;
      
      results.push({
        model,
        text: result.text,
        language: result.language,
        duration,
      });
      
      console.log(`\n${model}:`);
      console.log(`  文字: ${result.text.substring(0, 50)}...`);
      console.log(`  語言: ${result.language}`);
      console.log(`  延遲: ${duration}ms`);
    }

    // 找出最快的模型
    const fastest = results.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    );
    
    console.log(`\n🏆 最快的模型: ${fastest.model} (${fastest.duration}ms)`);
    
    // 確保所有模型都有回傳結果
    results.forEach(result => {
      expect(result.text).toBeTruthy();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });
  }, 120000); // 120 秒超時（測試所有模型）

  /**
   * 測試 6: 測試無效的模型名稱
   * 應該拋出錯誤或使用預設模型
   */
  it("should handle invalid model name gracefully", async () => {
    try {
      const result = await transcribeAudio(audioBuffer, filename, "normal", "invalid-model-name");
      // 如果沒有拋出錯誤，檢查是否有回傳結果
      expect(result).toBeDefined();
    } catch (error: any) {
      // 預期會拋出錯誤
      expect(error).toBeDefined();
      console.log("✅ 正確處理無效模型名稱:", error.message);
    }
  }, 30000);
});

/**
 * 使用說明：
 * 
 * 1. 準備測試音檔：
 *    mkdir -p test-audio
 *    # 將測試音檔放到 test-audio/sample.webm
 * 
 * 2. 執行所有測試：
 *    pnpm test server/asr.api.test.ts
 * 
 * 3. 執行特定測試：
 *    pnpm test server/asr.api.test.ts -t "whisper-1"
 * 
 * 4. 查看詳細輸出：
 *    pnpm test server/asr.api.test.ts --reporter=verbose
 * 
 * 注意事項：
 * - 這些測試會實際呼叫 OpenAI API，會產生費用
 * - 確保 OPENAI_API_KEY 環境變數已設定
 * - 測試音檔建議使用 1-3 秒的短音檔
 * - 測試音檔格式：WebM (opus codec)
 */
