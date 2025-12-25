/**
 * 兩段式翻譯服務（Two-Pass Translation Service）
 * 
 * 實作：
 * 1. Fast Pass（gpt-4.1）：快速翻譯，1-2 秒內顯示
 * 2. Quality Pass（gpt-4o）：醫療級定稿，3-6 秒內回填
 */

import { invokeLLM } from "./_core/llm";
import {
  buildFastPassPrompt,
  buildQualityPassPrompt,
  buildRetryPrompt,
  type ConversationContext,
} from "../shared/translationPrompts";
import {
  detectTranslationIssues,
  formatQualityCheckResult,
  type QualityCheckResult,
} from "../shared/qualityGate";

/**
 * Fast Pass 翻譯結果
 */
export interface FastPassResult {
  translatedText: string;
  model: string;
  duration: number;
  qualityCheck?: QualityCheckResult;
}

/**
 * Quality Pass 翻譯結果
 */
export interface QualityPassResult {
  translatedText: string;
  model: string;
  duration: number;
  qualityCheck: QualityCheckResult;
  retryCount: number;
}

/**
 * Fast Pass 翻譯（gpt-4.1）
 * 
 * 用途：
 * - 快速顯示 provisional 翻譯
 * - 1-2 秒內完成
 * - 不包含 context
 * 
 * @param sourceText 原文
 * @param sourceLang 原文語言
 * @param targetLang 目標語言
 * @param speakerRole 說話者角色
 * @returns Fast Pass 翻譯結果
 */
export async function fastPassTranslation(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  speakerRole: "nurse" | "patient"
): Promise<FastPassResult> {
  const startTime = Date.now();
  
  console.log(`[Fast Pass] 開始快速翻譯: ${sourceLang} → ${targetLang}`);
  console.log(`[Fast Pass] 原文: "${sourceText}"`);

  // 建立 Fast Pass prompt
  const prompt = buildFastPassPrompt(sourceText, sourceLang, targetLang, speakerRole);

  try {
    // 使用 gpt-4.1 進行快速翻譯
    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gpt-4.1", // Fast Pass 使用 gpt-4.1
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    const translatedText = typeof content === "string" ? content.trim() : "";
    const duration = Date.now() - startTime;

    console.log(`[Fast Pass] 翻譯完成: "${translatedText}" (耗時 ${duration}ms)`);

    // 執行基本品質檢查（不阻塞）
    const qualityCheck = detectTranslationIssues(
      sourceText,
      translatedText,
      sourceLang,
      targetLang
    );

    if (!qualityCheck.passed) {
      console.warn(`[Fast Pass] 品質檢查未通過:`);
      console.warn(formatQualityCheckResult(qualityCheck));
    }

    return {
      translatedText,
      model: "gpt-4.1",
      duration,
      qualityCheck,
    };
  } catch (error: any) {
    console.error(`[Fast Pass] 翻譯失敗:`, error);
    throw new Error(`Fast Pass translation failed: ${error.message}`);
  }
}

/**
 * Quality Pass 翻譯（gpt-4o）
 * 
 * 用途：
 * - 醫療級定稿翻譯
 * - 3-6 秒內完成
 * - 包含 context 和 glossary
 * - 自動重試（若 Quality Gate 檢測到問題）
 * 
 * @param sourceText 原文
 * @param sourceLang 原文語言
 * @param targetLang 目標語言
 * @param speakerRole 說話者角色
 * @param context 對話上下文（最近 3-6 句）
 * @param maxRetries 最大重試次數（預設 1 次）
 * @returns Quality Pass 翻譯結果
 */
export async function qualityPassTranslation(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  speakerRole: "nurse" | "patient",
  context: ConversationContext[] = [],
  maxRetries: number = 1
): Promise<QualityPassResult> {
  const startTime = Date.now();
  
  console.log(`[Quality Pass] 開始醫療級翻譯: ${sourceLang} → ${targetLang}`);
  console.log(`[Quality Pass] 原文: "${sourceText}"`);
  console.log(`[Quality Pass] Context: ${context.length} 句`);

  let retryCount = 0;
  let translatedText = "";
  let qualityCheck: QualityCheckResult | null = null;
  let previousTranslation = "";

  while (retryCount <= maxRetries) {
    try {
      // 建立 prompt（第一次用 Quality Pass，重試用 Retry Prompt）
      let prompt: string;
      if (retryCount === 0) {
        prompt = buildQualityPassPrompt(
          sourceText,
          sourceLang,
          targetLang,
          speakerRole,
          context,
          true // 包含 glossary
        );
      } else {
        const issues = qualityCheck?.issues.map(issue => issue.message) || [];
        prompt = buildRetryPrompt(
          sourceText,
          sourceLang,
          targetLang,
          speakerRole,
          previousTranslation,
          issues,
          context
        );
        console.log(`[Quality Pass] 重試第 ${retryCount} 次（上次翻譯有問題）`);
      }

      // 使用 gpt-4o 進行高品質翻譯
      const response = await invokeLLM({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "gpt-4o", // Quality Pass 使用 gpt-4o
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      translatedText = typeof content === "string" ? content.trim() : "";
      
      console.log(`[Quality Pass] 翻譯完成: "${translatedText}"`);

      // 執行品質檢查
      qualityCheck = detectTranslationIssues(
        sourceText,
        translatedText,
        sourceLang,
        targetLang
      );

      console.log(`[Quality Pass] 品質檢查:`);
      console.log(formatQualityCheckResult(qualityCheck));

      // 如果通過品質檢查，或已達最大重試次數，則結束
      if (qualityCheck.passed || retryCount >= maxRetries) {
        break;
      }

      // 品質檢查未通過，準備重試
      previousTranslation = translatedText;
      retryCount++;
      
      console.warn(`[Quality Pass] 品質檢查未通過，準備重試（${retryCount}/${maxRetries}）`);

    } catch (error: any) {
      console.error(`[Quality Pass] 翻譯失敗 (retry ${retryCount}):`, error);
      
      // 如果已達最大重試次數，則拋出錯誤
      if (retryCount >= maxRetries) {
        throw new Error(`Quality Pass translation failed after ${retryCount} retries: ${error.message}`);
      }
      
      retryCount++;
    }
  }

  const duration = Date.now() - startTime;
  
  console.log(`[Quality Pass] 完成（耗時 ${duration}ms，重試 ${retryCount} 次）`);

  return {
    translatedText,
    model: "gpt-4o",
    duration,
    qualityCheck: qualityCheck!,
    retryCount,
  };
}

/**
 * 兩段式翻譯（Fast Pass + Quality Pass）
 * 
 * 流程：
 * 1. 立刻執行 Fast Pass（gpt-4.1）
 * 2. 返回 Fast Pass 結果
 * 3. 背景執行 Quality Pass（gpt-4o）
 * 4. Quality Pass 完成後，前端可透過 callback 或 polling 取得結果
 * 
 * 注意：此函數只返回 Fast Pass 結果，Quality Pass 需另外呼叫
 */
export async function twoPassTranslation(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  speakerRole: "nurse" | "patient",
  context: ConversationContext[] = []
): Promise<{
  fastPass: FastPassResult;
  qualityPassPromise: Promise<QualityPassResult>;
}> {
  console.log(`[Two-Pass Translation] 開始兩段式翻譯`);

  // 1. 立刻執行 Fast Pass
  const fastPassPromise = fastPassTranslation(
    sourceText,
    sourceLang,
    targetLang,
    speakerRole
  );

  // 2. 同時啟動 Quality Pass（但不等待）
  const qualityPassPromise = qualityPassTranslation(
    sourceText,
    sourceLang,
    targetLang,
    speakerRole,
    context,
    1 // 最多重試 1 次
  );

  // 3. 等待 Fast Pass 完成
  const fastPass = await fastPassPromise;

  console.log(`[Two-Pass Translation] Fast Pass 完成，Quality Pass 背景執行中`);

  return {
    fastPass,
    qualityPassPromise,
  };
}
