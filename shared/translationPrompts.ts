/**
 * 翻譯 Prompt 模板
 * 
 * 分為兩種模式：
 * 1. Fast Pass（gpt-4.1）：快速翻譯，1-2 秒內顯示
 * 2. Quality Pass（gpt-4o）：醫療級定稿，3-6 秒內回填
 */

import { buildGlossaryPrompt } from "./glossary";

/**
 * 對話上下文（用於 Quality Pass）
 */
export interface ConversationContext {
  speaker: "nurse" | "patient";
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText?: string;
  timestamp: Date;
}

/**
 * Fast Pass Prompt（快速翻譯）
 * 
 * 特點：
 * - 簡潔明確
 * - 不包含 context
 * - 不強制 glossary（但會提示）
 * - 速度優先
 */
export function buildFastPassPrompt(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  speakerRole: "nurse" | "patient"
): string {
  const roleDescription = speakerRole === "nurse" 
    ? "護理人員（台灣人，說中文）" 
    : "病患或家屬（外國人）";

  return `你是專業的醫療翻譯助手。請將以下對話翻譯成${getLanguageName(targetLang)}。

說話者：${roleDescription}
原文語言：${getLanguageName(sourceLang)}
目標語言：${getLanguageName(targetLang)}

原文：
${sourceText}

翻譯要求：
1. 忠實翻譯，不可自行添加或省略資訊
2. 保留所有數字和單位（如：120/80 mmHg, 38.5℃, 500mg）
3. 保留否定詞（不、沒有、未、別）
4. 使用簡單易懂的語言
5. 只輸出翻譯結果，不要解釋

翻譯：`;
}

/**
 * Quality Pass Prompt（醫療級定稿）
 * 
 * 特點：
 * - 包含對話 context（最近 3-6 句）
 * - 強制使用 glossary
 * - 嚴格的醫療翻譯規則
 * - 品質優先
 */
export function buildQualityPassPrompt(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  speakerRole: "nurse" | "patient",
  context: ConversationContext[] = [],
  includeGlossary: boolean = true
): string {
  const roleDescription = speakerRole === "nurse" 
    ? "護理人員（台灣人，說中文）" 
    : "病患或家屬（外國人）";

  // 建立對話上下文
  const contextSection = context.length > 0
    ? `
對話上下文（最近 ${context.length} 句）：
${context.map((ctx, index) => {
  const ctxRole = ctx.speaker === "nurse" ? "護理人員" : "病患";
  return `${index + 1}. [${ctxRole}] ${ctx.sourceText}${ctx.translatedText ? ` → ${ctx.translatedText}` : ""}`;
}).join("\n")}
`
    : "";

  // 建立 Glossary 提示
  const glossarySection = includeGlossary
    ? `\n${buildGlossaryPrompt(targetLang)}\n`
    : "";

  return `你是專業的醫療翻譯專家。請將以下對話翻譯成${getLanguageName(targetLang)}。

說話者：${roleDescription}
原文語言：${getLanguageName(sourceLang)}
目標語言：${getLanguageName(targetLang)}
${contextSection}
原文：
${sourceText}

醫療翻譯規則（必須嚴格遵守）：
1. **忠實翻譯原則**
   - 不可自行添加診斷、建議或背景資訊
   - 不可省略任何原文內容
   - 若原文不完整或語意不明，保持原文風格，不要擅自補充

2. **數字與單位保護**
   - 所有數字必須完整保留（例：120/80, 38.5, 500）
   - 所有單位必須完整保留（例：mmHg, ℃, mg, ml, cc, 天, 週, 次）
   - 數字與單位的組合不可拆散（例：500mg 不可變成「五百毫克」）

3. **否定詞保護**
   - 否定詞不可遺漏或反轉（不、沒有、未、別、無、非）
   - 中文「不痛」→ 越南語「không đau」（不可變成「đau」）
   - 中文「沒有過敏」→ 越南語「không dị ứng」（不可變成「dị ứng」）

4. **術語一致性**
   ${glossarySection}
   - 必須使用上述術語對照表的翻譯
   - 不可使用其他變體或同義詞

5. **語言風格**
   - 使用簡單、清晰、易懂的語言
   - 避免醫學術語的過度專業化（除非原文使用）
   - 保持禮貌和同理心的語氣

6. **輸出格式**
   - 只輸出翻譯結果
   - 不要加入任何解釋、註解或元資訊
   - 不要使用引號、括號等標記

翻譯：`;
}

/**
 * 獲取語言名稱（中文）
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    "zh": "中文",
    "vi": "越南語",
    "id": "印尼語",
    "fil": "菲律賓語",
    "tl": "菲律賓語",
    "en": "英文",
    "it": "義大利語",
    "ja": "日文",
    "ko": "韓文",
    "th": "泰文",
  };
  return langMap[langCode.toLowerCase()] || langCode;
}

/**
 * 建立翻譯重試 Prompt（當 Quality Gate 檢測到問題時）
 * 
 * 特點：
 * - 明確指出上一次翻譯的問題
 * - 要求特別注意問題點
 * - 使用 Quality Pass 等級的嚴格規則
 */
export function buildRetryPrompt(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  speakerRole: "nurse" | "patient",
  previousTranslation: string,
  issues: string[],
  context: ConversationContext[] = []
): string {
  const basePrompt = buildQualityPassPrompt(
    sourceText,
    sourceLang,
    targetLang,
    speakerRole,
    context,
    true
  );

  const issuesSection = `
⚠️ 上一次翻譯存在以下問題：
${issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}

上一次翻譯（有問題）：
${previousTranslation}

請特別注意以上問題，重新翻譯：
`;

  // 在原 prompt 的「翻譯：」之前插入問題說明
  return basePrompt.replace("翻譯：", issuesSection);
}
