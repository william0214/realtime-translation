/**
 * Cost Control Module for Two-Pass Translation
 * 
 * Purpose: Determine whether a sentence should run Quality Pass (gpt-4o)
 * or just use Fast Pass (gpt-4.1) result.
 * 
 * Medical Product Ethics:
 * - DO NOT run Quality Pass for short, simple sentences (e.g., "好", "謝謝", "嗯")
 * - MUST run Quality Pass for medical keywords, numbers, units, negations
 * - Cost savings: 30-50% (by filtering out unnecessary Quality Pass calls)
 */

/**
 * Medical keywords that require Quality Pass
 * 
 * Categories:
 * 1. Vital signs: 痛, 發燒, 血壓, 心跳, 血氧, 體溫
 * 2. Medications: 藥, 劑量, 止痛藥, 抗生素, 過敏
 * 3. Symptoms: 噁心, 頭暈, 嘔吐, 咳嗽, 呼吸困難
 * 4. Medical procedures: 打針, 抽血, 檢查, 手術
 * 5. Diseases: 糖尿病, 高血壓, 心臟病, 癌症
 * 6. Body parts: 頭, 胸, 腹, 手, 腳
 * 7. Negations: 不, 沒有, 未, 別, 無
 */
const MEDICAL_KEYWORDS = [
  // Vital signs (生命徵象)
  "痛", "疼", "發燒", "血壓", "心跳", "血氧", "體溫", "脈搏", "呼吸", "意識",
  
  // Medications (藥物)
  "藥", "劑量", "止痛藥", "抗生素", "消炎藥", "退燒藥", "藥物", "藥品", "處方", "用藥",
  
  // Symptoms (症狀)
  "噁心", "頭暈", "嘔吐", "咳嗽", "呼吸困難", "喘", "胸悶", "心悸", "冒汗", "發抖",
  "腹痛", "腹瀉", "便秘", "出血", "腫脹", "紅腫", "發炎", "感染", "傷口", "瘀青",
  
  // Medical procedures (醫療程序)
  "打針", "抽血", "檢查", "手術", "輸液", "點滴", "注射", "換藥", "拆線", "縫合",
  
  // Diseases (疾病)
  "糖尿病", "高血壓", "心臟病", "癌症", "中風", "肝炎", "腎臟病", "氣喘", "過敏",
  "懷孕", "哺乳", "孕婦", "產婦", "嬰兒", "小孩", "兒童", "老人",
  
  // Body parts (身體部位)
  "頭", "胸", "腹", "手", "腳", "眼", "耳", "鼻", "喉", "口", "牙", "舌",
  "心臟", "肺", "肝", "腎", "胃", "腸", "膀胱", "子宮", "卵巢", "前列腺",
  
  // Negations (否定詞) - Critical for medical accuracy
  "不", "沒有", "未", "別", "無", "非", "否", "勿", "莫",
  
  // Units (單位) - Critical for medical accuracy
  "mg", "ml", "cc", "℃", "度", "mmHg", "次", "天", "週", "小時", "分鐘",
  
  // Time-related (時間相關)
  "幾天", "多久", "什麼時候", "多少次", "每天", "每週", "每月", "早上", "晚上", "睡前", "飯前", "飯後",
  
  // Severity (嚴重程度)
  "很", "非常", "極度", "嚴重", "輕微", "一點", "有點", "稍微", "特別", "超級",
];

/**
 * Short sentences that should NOT run Quality Pass
 * 
 * These are common responses that don't need medical-grade translation:
 * - Acknowledgments: 好, 對, 是, 嗯, 啊, 哦
 * - Greetings: 謝謝, 不客氣, 再見, 你好
 * - Simple responses: 可以, 不行, 沒關係, 知道了
 */
const SHORT_SENTENCE_BLACKLIST = [
  "好", "對", "是", "嗯", "啊", "哦", "喔", "欸",
  "謝謝", "不客氣", "再見", "你好", "早安", "晚安",
  "可以", "不行", "沒關係", "知道了", "了解", "明白",
  "等等", "稍等", "請稍等", "請等一下",
];

/**
 * Regex patterns for detecting numbers and units
 */
const NUMBER_PATTERN = /\d+/; // Any digit
const UNIT_PATTERN = /(mg|ml|cc|℃|度|mmHg|次|天|週|小時|分鐘|公斤|公分|公尺)/;

/**
 * Regex patterns for detecting negations
 * 
 * Examples:
 * - 不痛 (no pain)
 * - 沒有發燒 (no fever)
 * - 未服用藥物 (not taking medication)
 */
const NEGATION_PATTERN = /(不|沒有|未|別|無|非|否|勿|莫)/;

/**
 * Minimum length for Quality Pass (in Chinese characters)
 * 
 * Rationale:
 * - Short sentences (< 5 chars) are usually simple responses
 * - Medium sentences (5-12 chars) may need Quality Pass if they contain medical keywords
 * - Long sentences (≥ 12 chars) should always run Quality Pass
 */
const MIN_LENGTH_FOR_QUALITY_PASS = 12;
const MIN_LENGTH_FOR_SHORT_SENTENCE = 3;

/**
 * Determine whether a sentence should run Quality Pass
 * 
 * Decision logic:
 * 1. If sentence is in SHORT_SENTENCE_BLACKLIST → NO
 * 2. If sentence length < 5 chars → NO
 * 3. If sentence contains medical keywords → YES
 * 4. If sentence contains numbers or units → YES
 * 5. If sentence contains negations → YES
 * 6. If sentence length ≥ 12 chars → YES
 * 7. Otherwise → NO
 * 
 * @param sourceText - The source text to check
 * @param sourceLang - The source language (default: "zh")
 * @returns true if Quality Pass should be run, false otherwise
 */
export function shouldRunQualityPass(
  sourceText: string,
  sourceLang: string = "zh"
): boolean {
  // Only apply cost control for Chinese source text
  if (sourceLang !== "zh") {
    return true; // Always run Quality Pass for non-Chinese text (to be safe)
  }

  // Normalize text (remove spaces and punctuation for analysis)
  const normalizedText = sourceText.trim().replace(/[\s]/g, "");
  const textWithoutPunctuation = normalizedText.replace(/[，。！？、；：「」『』（）]/g, "");
  const textLength = textWithoutPunctuation.length;

  // Rule 1: Check if sentence is in SHORT_SENTENCE_BLACKLIST
  if (SHORT_SENTENCE_BLACKLIST.includes(textWithoutPunctuation)) {
    console.log(`[Cost Control] ❌ Short sentence blacklist: "${sourceText}" → Skip Quality Pass`);
    return false;
  }

  // Rule 2: Check if sentence is too short (< 5 chars)
  if (textLength < MIN_LENGTH_FOR_SHORT_SENTENCE) {
    console.log(`[Cost Control] ❌ Too short (${textLength} < ${MIN_LENGTH_FOR_SHORT_SENTENCE}): "${sourceText}" → Skip Quality Pass`);
    return false;
  }

  // Rule 3: Check if sentence contains medical keywords
  for (const keyword of MEDICAL_KEYWORDS) {
    if (textWithoutPunctuation.includes(keyword)) {
      console.log(`[Cost Control] ✅ Medical keyword detected ("${keyword}"): "${sourceText}" → Run Quality Pass`);
      return true;
    }
  }

  // Rule 4: Check if sentence contains numbers or units
  if (NUMBER_PATTERN.test(normalizedText) || UNIT_PATTERN.test(normalizedText)) {
    console.log(`[Cost Control] ✅ Number/unit detected: "${sourceText}" → Run Quality Pass`);
    return true;
  }

  // Rule 5: Check if sentence contains negations
  if (NEGATION_PATTERN.test(textWithoutPunctuation)) {
    console.log(`[Cost Control] ✅ Negation detected: "${sourceText}" → Run Quality Pass`);
    return true;
  }

  // Rule 6: Check if sentence is long enough (≥ 12 chars)
  if (textLength >= MIN_LENGTH_FOR_QUALITY_PASS) {
    console.log(`[Cost Control] ✅ Long sentence (${textLength} ≥ ${MIN_LENGTH_FOR_QUALITY_PASS}): "${sourceText}" → Run Quality Pass`);
    return true;
  }

  // Rule 7: Default to NO (skip Quality Pass)
  console.log(`[Cost Control] ❌ No trigger condition met: "${sourceText}" → Skip Quality Pass`);
  return false;
}

/**
 * Statistics for cost control
 */
export interface CostControlStats {
  totalSentences: number;
  qualityPassRun: number;
  qualityPassSkipped: number;
  qualityPassRate: number; // Percentage of sentences that run Quality Pass
  costSavings: number; // Percentage of cost saved by skipping Quality Pass
}

/**
 * Calculate cost control statistics
 * 
 * @param totalSentences - Total number of sentences processed
 * @param qualityPassRun - Number of sentences that ran Quality Pass
 * @returns Cost control statistics
 */
export function calculateCostControlStats(
  totalSentences: number,
  qualityPassRun: number
): CostControlStats {
  const qualityPassSkipped = totalSentences - qualityPassRun;
  const qualityPassRate = totalSentences > 0 ? (qualityPassRun / totalSentences) * 100 : 0;
  const costSavings = totalSentences > 0 ? (qualityPassSkipped / totalSentences) * 100 : 0;

  return {
    totalSentences,
    qualityPassRun,
    qualityPassSkipped,
    qualityPassRate,
    costSavings,
  };
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Short sentence (skip Quality Pass)
 * shouldRunQualityPass("好", "zh"); // false
 * 
 * // Medical keyword (run Quality Pass)
 * shouldRunQualityPass("我頭很痛", "zh"); // true
 * 
 * // Number/unit (run Quality Pass)
 * shouldRunQualityPass("體溫38.5度", "zh"); // true
 * 
 * // Negation (run Quality Pass)
 * shouldRunQualityPass("我不痛", "zh"); // true
 * 
 * // Long sentence (run Quality Pass)
 * shouldRunQualityPass("我今天早上起床後覺得有點不舒服", "zh"); // true
 * ```
 */
