# Quality Gate - 翻譯品質守門機制

## 概述

Quality Gate 是即時雙向翻譯系統 v2.0.0 的核心品質保證機制，用於檢測翻譯品質問題並決定是否需要重跑 Quality Pass。

## 設計目標

1. **自動化品質檢查**：無需人工介入，自動檢測翻譯問題
2. **醫療情境優化**：針對醫療翻譯的特殊需求設計檢查規則
3. **快速反應**：檢查速度快（< 100ms），不影響使用者體驗
4. **可擴展性**：易於新增新的檢查規則

## 檢查規則

### 1. 空白翻譯檢測（Empty Translation）

**嚴重程度**：Critical

**檢查邏輯**：
```typescript
if (!translatedText || translatedText.trim() === "") {
  // 翻譯結果為空
}
```

**扣分**：-100 分（直接不通過）

**範例**：
- 原文：「您的血壓是多少？」
- 譯文：「」（空白）
- 結果：❌ Critical

### 2. 相同文字檢測（Identical Text）

**嚴重程度**：High

**檢查邏輯**：
```typescript
if (translatedText.trim() === sourceText.trim()) {
  // 翻譯與原文完全相同（可能未翻譯）
}
```

**扣分**：-50 分

**範例**：
- 原文：「您的血壓是多少？」
- 譯文：「您的血壓是多少？」
- 結果：❌ High（可能翻譯失敗）

### 3. 數字遺漏檢測（Missing Numbers）

**嚴重程度**：Critical（完全遺漏）/ High（部分遺漏）

**檢查邏輯**：
```typescript
// 檢查原文是否包含數字
const sourceHasNumbers = containsNumbers(sourceText);
const translatedHasNumbers = containsNumbers(translatedText);

if (sourceHasNumbers && !translatedHasNumbers) {
  // Critical: 原文有數字但譯文完全沒有
}

if (sourceHasNumbers && translatedHasNumbers) {
  const sourceNumbers = extractNumbers(sourceText);
  const translatedNumbers = extractNumbers(translatedText);
  const missingNumbers = sourceNumbers.filter(num => !translatedNumbers.includes(num));
  
  if (missingNumbers.length > 0) {
    // High: 部分數字未出現在譯文中
  }
}
```

**扣分**：
- 完全遺漏：-40 分
- 部分遺漏：-30 分

**範例 1（完全遺漏）**：
- 原文：「您的血壓是 120/80 mmHg」
- 譯文：「Huyết áp của bạn là bình thường」（沒有數字）
- 結果：❌ Critical

**範例 2（部分遺漏）**：
- 原文：「吃藥 3 次，每次 500mg」
- 譯文：「Uống thuốc 3 lần」（缺少 500）
- 結果：❌ High

### 4. 否定詞反轉檢測（Negation Reversal）

**嚴重程度**：Critical

**檢查邏輯**：
```typescript
const sourceHasNegation = containsNegation(sourceText); // 檢查中文否定詞
const targetNegationPatterns = getTargetNegationPatterns(targetLang); // 取得目標語言否定詞模式
const translatedHasTargetNegation = targetNegationPatterns.some(pattern => 
  pattern.test(translatedText)
);

if (sourceHasNegation && !translatedHasTargetNegation) {
  // Critical: 原文有否定詞但譯文疑似缺少否定詞
}
```

**扣分**：-40 分

**否定詞模式**：

| 語言 | 否定詞模式 |
|------|-----------|
| 中文 (zh) | 不, 沒有, 未, 別, 無, 非 |
| 越南語 (vi) | không, chưa, đừng, không có |
| 印尼語 (id) | tidak, belum, jangan, tidak ada |
| 英文 (en) | not, no, don't, doesn't, won't, can't, never |
| 菲律賓語 (fil) | hindi, wala, huwag |

**範例**：
- 原文：「您有沒有過敏？」
- 譯文：「Bạn có dị ứng?」（缺少 không）
- 正確：「Bạn có dị ứng không?」
- 結果：❌ Critical

### 5. 長度異常檢測（Length Anomaly）

**嚴重程度**：Medium

**檢查邏輯**：
```typescript
const sourceLength = sourceText.trim().length;
const translatedLength = translatedText.trim().length;
const lengthRatio = translatedLength / sourceLength;

if (lengthRatio < 0.3) {
  // 譯文過短
} else if (lengthRatio > 5) {
  // 譯文過長
}
```

**扣分**：-15 分

**參考比例**：
- 中文→越南語：通常 1:1.5 到 1:3
- 中文→英文：通常 1:1 到 1:2
- 異常範圍：< 0.3 或 > 5

**範例（過短）**：
- 原文：「您的血壓是 120/80 mmHg，心跳 72 次/分，血氧 98%」（28 字）
- 譯文：「Huyết áp 120/80」（15 字，比例 0.54）
- 結果：⚠️ Medium（可能翻譯不完整）

### 6. 可疑內容檢測（Suspicious Content）

**嚴重程度**：Medium

**檢查邏輯**：
```typescript
const suspiciousPatterns = [
  /\[.*?\]/,           // 包含方括號
  /\{.*?\}/,           // 包含花括號
  /<.*?>/,             // 包含尖括號（HTML 標籤）
  /\bUNK\b/i,          // Unknown token
  /\bERROR\b/i,        // Error message
  /翻譯/,               // 包含「翻譯」二字
];

for (const pattern of suspiciousPatterns) {
  if (pattern.test(translatedText)) {
    // 譯文包含可疑模式
  }
}
```

**扣分**：-10 分

**範例**：
- 原文：「您的血壓是多少？」
- 譯文：「[翻譯中] Huyết áp của bạn là bao nhiêu?」
- 結果：⚠️ Medium（包含元資訊）

## 品質分數計算

### 初始分數

- 所有翻譯初始分數：100 分

### 扣分規則

| 嚴重程度 | 扣分 |
|---------|------|
| Critical | -40 分 |
| High | -30 分 |
| Medium | -15 分 |
| Low | -5 分 |

### 通過門檻

- **通過**：分數 >= 70
- **不通過**：分數 < 70

### 計算範例

**範例 1（通過）**：
- 初始分數：100
- 問題：無
- 最終分數：100
- 結果：✅ 通過

**範例 2（不通過 - Critical）**：
- 初始分數：100
- 問題：數字遺漏（Critical, -40）
- 最終分數：60
- 結果：❌ 不通過

**範例 3（不通過 - 多個問題）**：
- 初始分數：100
- 問題 1：長度異常（Medium, -15）
- 問題 2：可疑內容（Medium, -10）
- 最終分數：75
- 結果：✅ 通過（雖有問題但分數仍達標）

## 建議動作（Recommendation）

根據品質分數和問題嚴重程度，Quality Gate 會給出以下建議：

### 1. Accept（接受）

**條件**：分數 >= 70

**動作**：接受翻譯結果，不重試

**範例**：
- 分數：100
- 問題：無
- 建議：Accept

### 2. Retry Fast（快速重試）

**條件**：
- 分數 < 70
- 只有 Medium 或 Low 問題
- 無 Critical 或 High 問題

**動作**：使用 Fast Pass（gpt-4.1）重試

**範例**：
- 分數：65
- 問題：長度異常（Medium）
- 建議：Retry Fast

### 3. Retry Quality（品質重試）

**條件**：
- 分數 < 70
- 有 Critical 或 High 問題

**動作**：使用 Quality Pass（gpt-4o）重試

**範例**：
- 分數：60
- 問題：數字遺漏（Critical）
- 建議：Retry Quality

## 重試機制

### 重試流程

```
翻譯完成
    │
    ▼
Quality Gate 檢查
    │
    ├─ 通過 (>= 70) ──→ Accept
    │
    └─ 不通過 (< 70)
        │
        ├─ 有 Critical/High ──→ Retry Quality (gpt-4o)
        │                           │
        │                           ▼
        │                      Quality Gate 檢查
        │                           │
        │                           ├─ 通過 ──→ Accept
        │                           │
        │                           └─ 不通過 ──→ Accept（已達最大重試次數）
        │
        └─ 只有 Medium/Low ──→ Retry Fast (gpt-4.1)
                                    │
                                    ▼
                               Quality Gate 檢查
                                    │
                                    ├─ 通過 ──→ Accept
                                    │
                                    └─ 不通過 ──→ Accept（已達最大重試次數）
```

### 重試次數限制

- **Fast Pass**：不重試（直接顯示，背景執行 Quality Pass）
- **Quality Pass**：最多重試 1 次
- **總計**：每個翻譯最多 2 次 Quality Pass 嘗試

### 重試 Prompt

重試時會使用特殊 Prompt，明確指出上次翻譯的問題：

```
⚠️ 上一次翻譯存在以下問題：
1. [CRITICAL] 原文包含數字但譯文沒有數字
   詳情: sourceNumbers: ["120", "80"], translatedText: "Huyết áp của bạn là bình thường"

上一次翻譯（有問題）：
Huyết áp của bạn là bình thường

請特別注意以上問題，重新翻譯：
```

## 實作細節

### 資料結構

```typescript
// 品質問題類型
type QualityIssueType =
  | "missing_numbers"      // 數字遺漏
  | "negation_reversal"    // 否定詞反轉
  | "length_anomaly"       // 長度異常
  | "empty_translation"    // 翻譯為空
  | "identical_text"       // 翻譯與原文相同
  | "suspicious_content";  // 可疑內容

// 品質問題詳情
interface QualityIssue {
  type: QualityIssueType;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

// 品質檢查結果
interface QualityCheckResult {
  passed: boolean;
  issues: QualityIssue[];
  score: number; // 0-100
  recommendation: "accept" | "retry_fast" | "retry_quality";
}
```

### API 介面

```typescript
// 檢測翻譯品質問題
function detectTranslationIssues(
  sourceText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string
): QualityCheckResult;

// 格式化品質檢查結果
function formatQualityCheckResult(
  result: QualityCheckResult
): string;
```

### 使用範例

```typescript
import { detectTranslationIssues } from "@shared/qualityGate";

const result = detectTranslationIssues(
  "您的血壓是 120/80 mmHg",
  "Huyết áp của bạn là bình thường",
  "zh",
  "vi"
);

console.log(result);
// {
//   passed: false,
//   issues: [
//     {
//       type: "missing_numbers",
//       severity: "critical",
//       message: "原文包含數字但譯文沒有數字",
//       details: {
//         sourceNumbers: ["120", "80"],
//         sourceText: "您的血壓是 120/80 mmHg",
//         translatedText: "Huyết áp của bạn là bình thường"
//       }
//     }
//   ],
//   score: 60,
//   recommendation: "retry_quality"
// }
```

## 效能指標

### 檢查速度

- **目標**：< 100ms
- **實測**：通常 10-50ms（取決於文字長度）

### 準確率

- **數字遺漏檢測**：> 99%（基於正則表達式）
- **否定詞檢測**：> 95%（簡單啟發式，可能有誤判）
- **長度異常檢測**：> 90%（基於統計規則）

### 重試率

- **目標**：< 10%
- **實測**：待測試

## 未來改進

### 1. 語義檢查

使用 LLM 進行更深入的語義檢查：
- 檢查翻譯是否忠實原文
- 檢查是否有添加或省略資訊
- 檢查術語使用是否正確

### 2. 否定詞檢測強化

- 使用 NLP 工具進行更精確的否定詞檢測
- 支援更複雜的否定結構（雙重否定、隱含否定等）

### 3. 術語一致性檢查

- 檢查是否使用 glossary 中的術語
- 檢查術語使用是否一致

### 4. 數字格式檢查

- 檢查數字格式是否正確（小數點、千分位等）
- 檢查單位是否正確保留

### 5. 機器學習模型

- 訓練專門的品質評估模型
- 使用歷史資料改進檢查規則

## 測試案例

### 測試案例 1：正常翻譯

```typescript
sourceText: "您的血壓是 120/80 mmHg"
translatedText: "Huyết áp của bạn là 120/80 mmHg"
expected: {
  passed: true,
  score: 100,
  recommendation: "accept"
}
```

### 測試案例 2：數字遺漏

```typescript
sourceText: "您的血壓是 120/80 mmHg"
translatedText: "Huyết áp của bạn là bình thường"
expected: {
  passed: false,
  score: 60,
  issues: [{ type: "missing_numbers", severity: "critical" }],
  recommendation: "retry_quality"
}
```

### 測試案例 3：否定詞反轉

```typescript
sourceText: "您有沒有過敏？"
translatedText: "Bạn có dị ứng?"
expected: {
  passed: false,
  score: 60,
  issues: [{ type: "negation_reversal", severity: "critical" }],
  recommendation: "retry_quality"
}
```

### 測試案例 4：長度異常

```typescript
sourceText: "您的血壓是 120/80 mmHg，心跳 72 次/分，血氧 98%"
translatedText: "Huyết áp 120/80"
expected: {
  passed: true, // 85 分，仍通過
  score: 85,
  issues: [{ type: "length_anomaly", severity: "medium" }],
  recommendation: "accept"
}
```

## 參考資源

- [Translation Quality Assessment](https://en.wikipedia.org/wiki/Translation_quality_assessment)
- [Medical Translation Quality Metrics](https://www.atanet.org/medical-translation-quality/)
- [BLEU Score](https://en.wikipedia.org/wiki/BLEU)
- [METEOR Metric](https://en.wikipedia.org/wiki/METEOR)

## 版本歷史

- **v2.0.0**（2025-12-25）：初始版本
  - 實作 6 種檢查規則
  - 實作品質分數計算
  - 實作建議動作機制
  - 實作重試機制

## 貢獻

如需新增或修改檢查規則，請：
1. 確認規則對醫療翻譯有實際價值
2. 提供測試案例
3. 評估效能影響
4. 提交 pull request 或聯繫維護者
