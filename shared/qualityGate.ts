/**
 * Quality Gate - 翻譯品質守門機制
 * 
 * 用途：
 * - 檢測翻譯品質問題（數字遺漏、否定詞反轉、長度異常等）
 * - 決定是否需要重跑 Quality Pass
 * - 記錄品質檢查結果供後續分析
 */

import { containsNumbers, extractNumbers, containsNegation } from "./glossary";

/**
 * 品質問題類型
 */
export type QualityIssueType =
  | "missing_numbers"      // 數字遺漏
  | "negation_reversal"    // 否定詞反轉
  | "length_anomaly"       // 長度異常
  | "empty_translation"    // 翻譯為空
  | "identical_text"       // 翻譯與原文相同
  | "suspicious_content";  // 可疑內容

/**
 * 品質問題詳情
 */
export interface QualityIssue {
  type: QualityIssueType;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 品質檢查結果
 */
export interface QualityCheckResult {
  passed: boolean;
  issues: QualityIssue[];
  score: number; // 0-100，100 表示完美
  recommendation: "accept" | "retry_fast" | "retry_quality";
}

/**
 * 檢測翻譯品質問題
 * 
 * @param sourceText 原文
 * @param translatedText 譯文
 * @param sourceLang 原文語言
 * @param targetLang 目標語言
 * @returns 品質檢查結果
 */
export function detectTranslationIssues(
  sourceText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string
): QualityCheckResult {
  const issues: QualityIssue[] = [];
  let score = 100;

  // ==================== 1. 檢查翻譯是否為空 ====================
  if (!translatedText || translatedText.trim() === "") {
    issues.push({
      type: "empty_translation",
      severity: "critical",
      message: "翻譯結果為空",
    });
    score -= 100;
  }

  // ==================== 2. 檢查翻譯是否與原文相同 ====================
  if (translatedText.trim() === sourceText.trim()) {
    issues.push({
      type: "identical_text",
      severity: "high",
      message: "翻譯與原文完全相同（可能未翻譯）",
    });
    score -= 50;
  }

  // ==================== 3. 檢查數字遺漏 ====================
  const sourceHasNumbers = containsNumbers(sourceText);
  const translatedHasNumbers = containsNumbers(translatedText);

  if (sourceHasNumbers && !translatedHasNumbers) {
    const sourceNumbers = extractNumbers(sourceText);
    issues.push({
      type: "missing_numbers",
      severity: "critical",
      message: `原文包含數字但譯文沒有數字`,
      details: {
        sourceNumbers,
        sourceText,
        translatedText,
      },
    });
    score -= 40;
  } else if (sourceHasNumbers && translatedHasNumbers) {
    // 檢查數字是否完整保留
    const sourceNumbers = extractNumbers(sourceText);
    const translatedNumbers = extractNumbers(translatedText);
    
    const missingNumbers = sourceNumbers.filter(num => !translatedNumbers.includes(num));
    if (missingNumbers.length > 0) {
      issues.push({
        type: "missing_numbers",
        severity: "high",
        message: `部分數字未出現在譯文中`,
        details: {
          missingNumbers,
          sourceNumbers,
          translatedNumbers,
        },
      });
      score -= 30;
    }
  }

  // ==================== 4. 檢查否定詞反轉 ====================
  const sourceHasNegation = containsNegation(sourceText);
  const translatedHasNegation = containsNegation(translatedText);

  // 簡單啟發式：如果原文有否定詞，譯文也應該有否定詞（反之亦然）
  // 注意：這是簡化版本，實際可能需要更複雜的語義分析
  if (sourceHasNegation !== translatedHasNegation) {
    // 檢查目標語言的否定詞
    const targetNegationPatterns = getTargetNegationPatterns(targetLang);
    const translatedHasTargetNegation = targetNegationPatterns.some(pattern => 
      pattern.test(translatedText)
    );

    if (sourceHasNegation && !translatedHasTargetNegation) {
      issues.push({
        type: "negation_reversal",
        severity: "critical",
        message: `原文包含否定詞但譯文疑似缺少否定詞`,
        details: {
          sourceText,
          translatedText,
          targetLang,
        },
      });
      score -= 40;
    }
  }

  // ==================== 5. 檢查長度異常 ====================
  const sourceLength = sourceText.trim().length;
  const translatedLength = translatedText.trim().length;
  const lengthRatio = translatedLength / sourceLength;

  // 啟發式規則：
  // - 中文→越南語：通常 1:1.5 到 1:3
  // - 中文→英文：通常 1:1 到 1:2
  // - 如果譯文過短（< 0.3）或過長（> 5），可能有問題
  if (lengthRatio < 0.3) {
    issues.push({
      type: "length_anomaly",
      severity: "medium",
      message: `譯文長度過短（原文 ${sourceLength} 字，譯文 ${translatedLength} 字，比例 ${lengthRatio.toFixed(2)}）`,
      details: {
        sourceLength,
        translatedLength,
        lengthRatio,
      },
    });
    score -= 15;
  } else if (lengthRatio > 5) {
    issues.push({
      type: "length_anomaly",
      severity: "medium",
      message: `譯文長度過長（原文 ${sourceLength} 字，譯文 ${translatedLength} 字，比例 ${lengthRatio.toFixed(2)}）`,
      details: {
        sourceLength,
        translatedLength,
        lengthRatio,
      },
    });
    score -= 15;
  }

  // ==================== 6. 檢查可疑內容 ====================
  // 檢查是否包含常見的翻譯錯誤模式
  const suspiciousPatterns = [
    /\[.*?\]/,           // 包含方括號（可能是未處理的標記）
    /\{.*?\}/,           // 包含花括號
    /<.*?>/,             // 包含尖括號（HTML 標籤）
    /\bUNK\b/i,          // Unknown token
    /\bERROR\b/i,        // Error message
    /翻譯/,               // 包含「翻譯」二字（可能是 meta 內容）
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(translatedText)) {
      issues.push({
        type: "suspicious_content",
        severity: "medium",
        message: `譯文包含可疑模式：${pattern}`,
        details: {
          pattern: pattern.toString(),
          translatedText,
        },
      });
      score -= 10;
      break; // 只報告一次
    }
  }

  // ==================== 決定建議動作 ====================
  const passed = score >= 70; // 70 分以上視為通過
  let recommendation: QualityCheckResult["recommendation"] = "accept";

  if (!passed) {
    // 有 critical 問題 → 必須用 Quality Pass 重跑
    const hasCriticalIssue = issues.some(issue => issue.severity === "critical");
    if (hasCriticalIssue) {
      recommendation = "retry_quality";
    } else {
      // 只有 medium/low 問題 → 可以用 Fast Pass 重試
      recommendation = "retry_fast";
    }
  }

  return {
    passed,
    issues,
    score: Math.max(0, score),
    recommendation,
  };
}

/**
 * 根據目標語言獲取否定詞模式
 */
function getTargetNegationPatterns(targetLang: string): RegExp[] {
  switch (targetLang.toLowerCase()) {
    case "vi":
    case "vietnamese":
      return [
        /không/gi,      // 不
        /chưa/gi,       // 未
        /đừng/gi,       // 別
        /không có/gi,   // 沒有
      ];
    case "id":
    case "indonesian":
      return [
        /tidak/gi,      // 不
        /belum/gi,      // 未
        /jangan/gi,     // 別
        /tidak ada/gi,  // 沒有
      ];
    case "en":
    case "english":
      return [
        /\bnot\b/gi,
        /\bno\b/gi,
        /\bdon't\b/gi,
        /\bdoesn't\b/gi,
        /\bwon't\b/gi,
        /\bcan't\b/gi,
        /\bnever\b/gi,
      ];
    case "fil":
    case "filipino":
    case "tl":
    case "tagalog":
      return [
        /hindi/gi,      // 不
        /wala/gi,       // 沒有
        /huwag/gi,      // 別
      ];
    default:
      return []; // 無法檢測，返回空陣列
  }
}

/**
 * 格式化品質檢查結果為可讀字串
 */
export function formatQualityCheckResult(result: QualityCheckResult): string {
  const lines: string[] = [];
  
  lines.push(`品質分數: ${result.score}/100 (${result.passed ? "通過" : "未通過"})`);
  lines.push(`建議動作: ${result.recommendation}`);
  
  if (result.issues.length > 0) {
    lines.push(`\n發現 ${result.issues.length} 個問題：`);
    result.issues.forEach((issue, index) => {
      lines.push(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      if (issue.details) {
        lines.push(`   詳情: ${JSON.stringify(issue.details, null, 2)}`);
      }
    });
  }
  
  return lines.join("\n");
}
