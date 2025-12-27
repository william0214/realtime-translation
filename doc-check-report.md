# 文件檢查報告

**檢查時間:** 2025-12-27T10:39:11.195Z

## 📊 檢查摘要

| 項目 | 數量 |
|------|------|
| 總檔案數 | 10 |
| 總問題數 | 143 |
| 錯誤 (❌) | 17 |
| 警告 (⚠️) | 123 |
| 資訊 (ℹ️) | 3 |
| 總耗時 | 87ms |

## 📝 模型名稱檢查

- **檢查檔案數:** 10
- **發現問題數:** 18
- **耗時:** 36ms

### 問題列表

#### 1. ⚠️ 可能的未知模型名稱: "
┌─────────────────────────────────────────────────────────────┐
│                     使用者說話                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  VAD + ASR (Whisper)                         │
│              語音活動偵測 + 語音識別                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Final Transcript 完整文字                        │
│         （保留完整 transcript，不只最後 2 秒）                  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌───────────────────────┐   ┌───────────────────────┐
│   Fast Pass (gpt-4.1) │   │ Quality Pass (gpt-4o) │
│   快速翻譯（1-2 秒）    │   │ 醫療級定稿（3-6 秒）    │
│   - 不含 context       │   │ - 含 context (3-6句)  │
│   - 不強制 glossary    │   │ - 強制 glossary        │
│   - 速度優先           │   │ - 品質優先             │
└───────────────────────┘   └───────────────────────┘
                │                       │
                ▼                       │
┌───────────────────────┐               │
│  顯示 provisional 翻譯 │               │
│  translationStage:     │               │
│  "provisional"         │               │
└───────────────────────┘               │
                                        ▼
                            ┌───────────────────────┐
                            │   Quality Gate 檢查    │
                            │   - 數字遺漏檢測       │
                            │   - 否定詞反轉檢測     │
                            │   - 長度異常檢測       │
                            └───────────────────────┘
                                        │
                            ┌───────────┴───────────┐
                            │                       │
                         Pass                    Fail
                            │                       │
                            ▼                       ▼
                ┌───────────────────────┐   ┌───────────────────────┐
                │  回填 final 翻譯       │   │  重跑 Quality Pass     │
                │  translationStage:     │   │  (最多 1 次)           │
                │  "final"               │   └───────────────────────┘
                └───────────────────────┘
"

- **檔案:** `docs/ARCHITECTURE-v2.0.md:20`
- **實際:** `
┌─────────────────────────────────────────────────────────────┐
│                     使用者說話                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  VAD + ASR (Whisper)                         │
│              語音活動偵測 + 語音識別                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Final Transcript 完整文字                        │
│         （保留完整 transcript，不只最後 2 秒）                  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌───────────────────────┐   ┌───────────────────────┐
│   Fast Pass (gpt-4.1) │   │ Quality Pass (gpt-4o) │
│   快速翻譯（1-2 秒）    │   │ 醫療級定稿（3-6 秒）    │
│   - 不含 context       │   │ - 含 context (3-6句)  │
│   - 不強制 glossary    │   │ - 強制 glossary        │
│   - 速度優先           │   │ - 品質優先             │
└───────────────────────┘   └───────────────────────┘
                │                       │
                ▼                       │
┌───────────────────────┐               │
│  顯示 provisional 翻譯 │               │
│  translationStage:     │               │
│  "provisional"         │               │
└───────────────────────┘               │
                                        ▼
                            ┌───────────────────────┐
                            │   Quality Gate 檢查    │
                            │   - 數字遺漏檢測       │
                            │   - 否定詞反轉檢測     │
                            │   - 長度異常檢測       │
                            └───────────────────────┘
                                        │
                            ┌───────────┴───────────┐
                            │                       │
                         Pass                    Fail
                            │                       │
                            ▼                       ▼
                ┌───────────────────────┐   ┌───────────────────────┐
                │  回填 final 翻譯       │   │  重跑 Quality Pass     │
                │  translationStage:     │   │  (最多 1 次)           │
                │  "final"               │   └───────────────────────┘
                └───────────────────────┘
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 2. ⚠️ 可能的未知模型名稱: "

#### Context 使用

- Fast Pass：不使用 context
- Quality Pass：使用最近 3-6 句 context
- Retry：使用相同 context + 上次翻譯的問題說明

## 驗收標準

1. **Fast Pass 速度**
   - 使用者說一句中文（醫療問句）
   - 畫面 1–2 秒內先顯示 provisional 翻譯（gpt-4.1）

2. **Quality Pass 回填**
   - 3–6 秒內同一 bubble 被回填為高品質 final 翻譯（gpt-4o）
   - 術語一致、數字單位不丟

3. **完整句子翻譯**
   - 不再出現「只翻到後半句」的常見缺前文問題
   - 至少在文字翻譯層面修正

4. **VAD UI 移除**
   - Settings 頁面沒有任何 VAD UI
   - 舊 localStorage 不再影響 VAD 行為

5. **Quality Gate 守門**
   - 檢測到問題時自動重跑 Quality Pass
   - 醫療術語翻譯一致（BP→huyết áp, HR→nhịp tim, SpO2→oxy máu）
   - 數字單位不遺漏（120/80 mmHg, 38.5℃, 500mg）
   - 否定詞不反轉（不痛→không đau, 沒有過敏→không dị ứng）

## 效能指標

### 目標延遲

- **Fast Pass**：1-2 秒
- **Quality Pass**：3-6 秒
- **Total E2E**：< 7 秒（從語音結束到 final 翻譯顯示）

### 品質指標

- **Quality Gate 通過率**：> 90%
- **重試率**：< 10%
- **術語一致性**：100%（強制 glossary）
- **數字保留率**：100%
- **否定詞保留率**：> 95%

## 檔案結構

"

- **檔案:** `docs/ARCHITECTURE-v2.0.md:353`
- **實際:** `

#### Context 使用

- Fast Pass：不使用 context
- Quality Pass：使用最近 3-6 句 context
- Retry：使用相同 context + 上次翻譯的問題說明

## 驗收標準

1. **Fast Pass 速度**
   - 使用者說一句中文（醫療問句）
   - 畫面 1–2 秒內先顯示 provisional 翻譯（gpt-4.1）

2. **Quality Pass 回填**
   - 3–6 秒內同一 bubble 被回填為高品質 final 翻譯（gpt-4o）
   - 術語一致、數字單位不丟

3. **完整句子翻譯**
   - 不再出現「只翻到後半句」的常見缺前文問題
   - 至少在文字翻譯層面修正

4. **VAD UI 移除**
   - Settings 頁面沒有任何 VAD UI
   - 舊 localStorage 不再影響 VAD 行為

5. **Quality Gate 守門**
   - 檢測到問題時自動重跑 Quality Pass
   - 醫療術語翻譯一致（BP→huyết áp, HR→nhịp tim, SpO2→oxy máu）
   - 數字單位不遺漏（120/80 mmHg, 38.5℃, 500mg）
   - 否定詞不反轉（不痛→không đau, 沒有過敏→không dị ứng）

## 效能指標

### 目標延遲

- **Fast Pass**：1-2 秒
- **Quality Pass**：3-6 秒
- **Total E2E**：< 7 秒（從語音結束到 final 翻譯顯示）

### 品質指標

- **Quality Gate 通過率**：> 90%
- **重試率**：< 10%
- **術語一致性**：100%（強制 glossary）
- **數字保留率**：100%
- **否定詞保留率**：> 95%

## 檔案結構

`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 3. ❌ 未知的模型名稱: "gpt-3.5-turbo-instruct"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:310`
- **實際:** `gpt-3.5-turbo-instruct`
- **建議:** 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

#### 4. ❌ 未知的模型名稱: "gpt-4o-realtime-preview"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:677`
- **實際:** `gpt-4o-realtime-preview`
- **建議:** 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

#### 5. ❌ 未知的模型名稱: "gpt-3.5-turbo-instruct"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:768`
- **實際:** `gpt-3.5-turbo-instruct`
- **建議:** 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

#### 6. ⚠️ 可能的未知模型名稱: "
❓ docs/example.md:120
   Invalid translation model: "gpt-3.5-turbo-instruct"
   
   Valid models (from TRANSLATION_MODEL_ALLOWLIST):
   - gpt-4.1-mini
   - gpt-4o-mini
   - gpt-4.1
   - gpt-4o
   
   Suggestion: Replace with "gpt-4.1-mini" (default) or "gpt-4o" (high quality)
"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:308`
- **實際:** `
❓ docs/example.md:120
   Invalid translation model: "gpt-3.5-turbo-instruct"
   
   Valid models (from TRANSLATION_MODEL_ALLOWLIST):
   - gpt-4.1-mini
   - gpt-4o-mini
   - gpt-4.1
   - gpt-4o
   
   Suggestion: Replace with "gpt-4.1-mini" (default) or "gpt-4o" (high quality)
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 7. ⚠️ 可能的未知模型名稱: "
❌ docs/realtime-subtitle-translation-spec.md:556
   Parameter "model" default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Suggestion: Update table cell to "gpt-4.1-mini"
"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:348`
- **實際:** `
❌ docs/realtime-subtitle-translation-spec.md:556
   Parameter "model" default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Suggestion: Update table cell to "gpt-4.1-mini"
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 8. ⚠️ 可能的未知模型名稱: "

2. docs/realtime-subtitle-translation-spec.md:556
   Parameter default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Fix: Update table cell to "gpt-4.1-mini"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 High Priority Issues (1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. docs/ARCHITECTURE-v2.0.md:456
   API procedure signature mismatch
   
   Code: trpc.translate.qualityPass.useMutation()
   Input: { messageId: number, conversationContext: ConversationContext }
   
   Doc shows: Input: { messageId: string }
   
   Fix: Update input type to "number"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔵 Medium Priority Issues (2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. docs/ai/ManusAI_SystemPrompt_Engineering.md:273
   Line number reference out of range
   
   File: shared/config.ts
   Referenced line: 205
   Actual file length: 180 lines
   
   Fix: Update line number or check if code moved

5. README.md:45
   File path does not exist: "docs/API_REFERENCE.md"
   
   Fix: Create missing file or remove reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check Type          | Issues | Pass Rate
--------------------|--------|----------
Model Names         |      2 |      93%
Config Parameters   |      1 |      97%
File Paths          |      2 |      95%
State Machines      |      0 |     100%
API Interfaces      |      0 |     100%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Check failed with 5 issues
"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:681`
- **實際:** `

2. docs/realtime-subtitle-translation-spec.md:556
   Parameter default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Fix: Update table cell to "gpt-4.1-mini"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 High Priority Issues (1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. docs/ARCHITECTURE-v2.0.md:456
   API procedure signature mismatch
   
   Code: trpc.translate.qualityPass.useMutation()
   Input: { messageId: number, conversationContext: ConversationContext }
   
   Doc shows: Input: { messageId: string }
   
   Fix: Update input type to "number"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔵 Medium Priority Issues (2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. docs/ai/ManusAI_SystemPrompt_Engineering.md:273
   Line number reference out of range
   
   File: shared/config.ts
   Referenced line: 205
   Actual file length: 180 lines
   
   Fix: Update line number or check if code moved

5. README.md:45
   File path does not exist: "docs/API_REFERENCE.md"
   
   Fix: Create missing file or remove reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check Type          | Issues | Pass Rate
--------------------|--------|----------
Model Names         |      2 |      93%
Config Parameters   |      1 |      97%
File Paths          |      2 |      95%
State Machines      |      0 |     100%
API Interfaces      |      0 |     100%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Check failed with 5 issues
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 9. ⚠️ 可能的未知模型名稱: "  
**Severity**: 🔴 Critical

**Problem**: Document references invalid model "gpt-3.5-turbo-instruct"

**Expected**: 使用 config.ts 中定義的模型

**Fix**: 更換為 "gpt-4.1-mini" (預設) 或 "gpt-4o" (高品質)

---

[... more issues ...]

## Statistics

### Check Type Breakdown

| Check Type | Issues | Pass Rate |
|------------|--------|-----------|
| Model Names | 2 | 93% |
| Config Parameters | 1 | 97% |
| File Paths | 2 | 95% |
| State Machines | 0 | 100% |
| API Interfaces | 0 | 100% |

### Files with Issues

| File | Issues |
|------|--------|
| docs/realtime-subtitle-translation-spec.md | 2 |
| docs/ARCHITECTURE-v2.0.md | 1 |
| docs/ai/ManusAI_SystemPrompt_Engineering.md | 1 |
| README.md | 1 |
"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:765`
- **實際:** `  
**Severity**: 🔴 Critical

**Problem**: Document references invalid model "gpt-3.5-turbo-instruct"

**Expected**: 使用 config.ts 中定義的模型

**Fix**: 更換為 "gpt-4.1-mini" (預設) 或 "gpt-4o" (高品質)

---

[... more issues ...]

## Statistics

### Check Type Breakdown

| Check Type | Issues | Pass Rate |
|------------|--------|-----------|
| Model Names | 2 | 93% |
| Config Parameters | 1 | 97% |
| File Paths | 2 | 95% |
| State Machines | 0 | 100% |
| API Interfaces | 0 | 100% |

### Files with Issues

| File | Issues |
|------|--------|
| docs/realtime-subtitle-translation-spec.md | 2 |
| docs/ARCHITECTURE-v2.0.md | 1 |
| docs/ai/ManusAI_SystemPrompt_Engineering.md | 1 |
| README.md | 1 |
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 10. ⚠️ 可能的未知模型名稱: "typescript
// SSOT (Single Source of Truth) 區塊
export const ALLOWED_ASR_MODELS = [
  "whisper-1",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
] as const;

// UI 選單自動生成（引用 SSOT）
const AVAILABLE_ASR_MODELS = ALLOWED_ASR_MODELS.map(...);

// WHISPER_CONFIG 引用 SSOT
export const WHISPER_CONFIG = {
  MODEL: "gpt-4o-mini-transcribe" as AllowedASRModel,
  AVAILABLE_MODELS: AVAILABLE_ASR_MODELS,
  // ...
} as const;
"

- **檔案:** `docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:31`
- **實際:** `typescript
// SSOT (Single Source of Truth) 區塊
export const ALLOWED_ASR_MODELS = [
  "whisper-1",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
] as const;

// UI 選單自動生成（引用 SSOT）
const AVAILABLE_ASR_MODELS = ALLOWED_ASR_MODELS.map(...);

// WHISPER_CONFIG 引用 SSOT
export const WHISPER_CONFIG = {
  MODEL: "gpt-4o-mini-transcribe" as AllowedASRModel,
  AVAILABLE_MODELS: AVAILABLE_ASR_MODELS,
  // ...
} as const;
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 11. ⚠️ 可能的未知模型名稱: "typescript
// SSOT (Single Source of Truth) 區塊
export const ALLOWED_TRANSLATION_MODELS = [
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o",
] as const;

// UI 選單自動生成（引用 SSOT）
const AVAILABLE_TRANSLATION_MODELS = ALLOWED_TRANSLATION_MODELS.map(...);

// TRANSLATION_CONFIG 引用 SSOT
export const TRANSLATION_CONFIG = {
  LLM_MODEL: "gpt-4.1-mini" as AllowedTranslationModel,
  AVAILABLE_TRANSLATION_MODELS: AVAILABLE_TRANSLATION_MODELS,
  // ...
} as const;
"

- **檔案:** `docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:68`
- **實際:** `typescript
// SSOT (Single Source of Truth) 區塊
export const ALLOWED_TRANSLATION_MODELS = [
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o",
] as const;

// UI 選單自動生成（引用 SSOT）
const AVAILABLE_TRANSLATION_MODELS = ALLOWED_TRANSLATION_MODELS.map(...);

// TRANSLATION_CONFIG 引用 SSOT
export const TRANSLATION_CONFIG = {
  LLM_MODEL: "gpt-4.1-mini" as AllowedTranslationModel,
  AVAILABLE_TRANSLATION_MODELS: AVAILABLE_TRANSLATION_MODELS,
  // ...
} as const;
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 12. ⚠️ 可能的未知模型名稱: "

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

**動作**：使用 Fast Pass（gpt-4.1-mini，來自 "

- **檔案:** `docs/QUALITY_GATE.md:175`
- **實際:** `

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

**動作**：使用 Fast Pass（gpt-4.1-mini，來自 `
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 13. ⚠️ 可能的未知模型名稱: " SSOT）重試

**範例**：
- 分數：65
- 問題：長度異常（Medium）
- 建議：Retry Fast

### 3. Retry Quality（品質重試）

**條件**：
- 分數 < 70
- 有 Critical 或 High 問題

**動作**：使用 Quality Pass（gpt-4o，來自 "

- **檔案:** `docs/QUALITY_GATE.md:247`
- **實際:** ` SSOT）重試

**範例**：
- 分數：65
- 問題：長度異常（Medium）
- 建議：Retry Fast

### 3. Retry Quality（品質重試）

**條件**：
- 分數 < 70
- 有 Critical 或 High 問題

**動作**：使用 Quality Pass（gpt-4o，來自 `
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 14. ⚠️ 可能的未知模型名稱: "
翻譯完成
    │
    ▼
Quality Gate 檢查
    │
    ├─ 通過 (>= 70) ──→ Accept
    │
    └─ 不通過 (< 70)
        │
        ├─ 有 Critical/High ──→ Retry Quality (gpt-4o, SSOT)
        │                           │
        │                           ▼
        │                      Quality Gate 檢查
        │                           │
        │                           ├─ 通過 ──→ Accept
        │                           │
        │                           └─ 不通過 ──→ Accept（已達最大重試次數）
        │
        └─ 只有 Medium/Low ──→ Retry Fast (gpt-4.1-mini, SSOT)
                                    │
                                    ▼
                               Quality Gate 檢查
                                    │
                                    ├─ 通過 ──→ Accept
                                    │
                                    └─ 不通過 ──→ Accept（已達最大重試次數）
"

- **檔案:** `docs/QUALITY_GATE.md:271`
- **實際:** `
翻譯完成
    │
    ▼
Quality Gate 檢查
    │
    ├─ 通過 (>= 70) ──→ Accept
    │
    └─ 不通過 (< 70)
        │
        ├─ 有 Critical/High ──→ Retry Quality (gpt-4o, SSOT)
        │                           │
        │                           ▼
        │                      Quality Gate 檢查
        │                           │
        │                           ├─ 通過 ──→ Accept
        │                           │
        │                           └─ 不通過 ──→ Accept（已達最大重試次數）
        │
        └─ 只有 Medium/Low ──→ Retry Fast (gpt-4.1-mini, SSOT)
                                    │
                                    ▼
                               Quality Gate 檢查
                                    │
                                    ├─ 通過 ──→ Accept
                                    │
                                    └─ 不通過 ──→ Accept（已達最大重試次數）
`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 15. ⚠️ 可能的未知模型名稱: " | 結構化輸出格式 | JSON Schema 定義 |

**模型選擇建議**如下：

**gpt-4o** 為旗艦模型，提供最高的翻譯品質與最佳的專業術語處理能力。適用於醫療場景與高品質要求場景（Quality Pass），延遲約 1.0-1.5 秒。該模型支援複雜句式翻譯與文化適應性調整，是兩段式翻譯流程中 Quality Pass 的預設選擇。

**gpt-4.1-mini** 為快速翻譯模型（**系統預設**），提供最佳的速度與品質平衡。適用於即時翻譯場景（Fast Pass），延遲約 0.8-1.2 秒。該模型在保持良好翻譯品質的同時提供快速回應，是兩段式翻譯流程中 Fast Pass 的預設選擇。

**gpt-4.1** 為高品質翻譯模型，提供優異的翻譯品質與專業術語處理能力。適用於進階翻譯場景，延遲約 1.2-1.8 秒。該模型在醫療術語翻譯與文化適應性上表現優異，可作為 Quality Pass 的替代選擇。

**gpt-4o-mini** 為輕量模型，在保持高品質的同時大幅降低延遲與成本。適用於一般對話場景，延遲約 0.8-1.3 秒。該模型提供良好的效能與成本平衡，可作為 Fast Pass 的替代選擇（非預設模型）。


### 4.3 TTS 參數

系統整合 OpenAI TTS API 提供語音合成功能，支援多種語音與語速調整。

| 參數名稱 | 資料型別 | 預設值 | 說明 | 可選值 |
|---------|---------|--------|------|--------|
| "

- **檔案:** `docs/realtime-subtitle-translation-spec.md:564`
- **實際:** ` | 結構化輸出格式 | JSON Schema 定義 |

**模型選擇建議**如下：

**gpt-4o** 為旗艦模型，提供最高的翻譯品質與最佳的專業術語處理能力。適用於醫療場景與高品質要求場景（Quality Pass），延遲約 1.0-1.5 秒。該模型支援複雜句式翻譯與文化適應性調整，是兩段式翻譯流程中 Quality Pass 的預設選擇。

**gpt-4.1-mini** 為快速翻譯模型（**系統預設**），提供最佳的速度與品質平衡。適用於即時翻譯場景（Fast Pass），延遲約 0.8-1.2 秒。該模型在保持良好翻譯品質的同時提供快速回應，是兩段式翻譯流程中 Fast Pass 的預設選擇。

**gpt-4.1** 為高品質翻譯模型，提供優異的翻譯品質與專業術語處理能力。適用於進階翻譯場景，延遲約 1.2-1.8 秒。該模型在醫療術語翻譯與文化適應性上表現優異，可作為 Quality Pass 的替代選擇。

**gpt-4o-mini** 為輕量模型，在保持高品質的同時大幅降低延遲與成本。適用於一般對話場景，延遲約 0.8-1.3 秒。該模型提供良好的效能與成本平衡，可作為 Fast Pass 的替代選擇（非預設模型）。


### 4.3 TTS 參數

系統整合 OpenAI TTS API 提供語音合成功能，支援多種語音與語速調整。

| 參數名稱 | 資料型別 | 預設值 | 說明 | 可選值 |
|---------|---------|--------|------|--------|
| `
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 16. ⚠️ 可能的未知模型名稱: "

**實際執行流程**：

1. **ASR 轉錄**：使用者說：「你有沒有過敏？」
2. **Fast Pass**（gpt-4.1-mini，1.0 秒）：翻譯為「Bạn có dị ứng không?」
3. **UI 顯示**：使用者看到 provisional 翻譯（標記 ⏳）
4. **shouldRunQualityPass()**：檢測到「過敏」關鍵詞與「沒有」否定詞 → 觸發 Quality Pass
5. **Quality Pass**（gpt-4o，1.5 秒）：翻譯為「Bạn có bị dị ứng không?」
6. **UI 回填**：同一 bubble 更新為 final 翻譯（標記 ✅）

**成本分析**：
- Fast Pass：$0.002 / 句
- Quality Pass：$0.008 / 句（僅觸發時）
- 觸發率：約 30-40%（醫療對話）
- 平均成本：$0.002 + $0.008 × 0.35 = $0.0048 / 句

---

#### 範例 5：Fast Pass 失敗 + Quality Pass 成功

**場景描述**：Fast Pass 翻譯品質不佳，Quality Gate 檢測到問題並觸發重試。

**執行流程**：

1. **ASR 轉錄**：「血壓 120/80 mmHg」
2. **Fast Pass**（gpt-4.1-mini）：翻譯為「Huyết áp 120/80」（遺漏 mmHg）
3. **Quality Gate 檢測**：
   - 檢測到數字遺漏（mmHg 未出現在譯文）
   - 嚴重程度：Critical
   - 建議動作：retry_quality
4. **Quality Pass 重試**（gpt-4o）：翻譯為「Huyết áp 120/80 mmHg」
5. **Quality Gate 再次檢測**：通過（數字單位完整）
6. **UI 顯示**：直接顯示 Quality Pass 結果（跳過 Fast Pass）

**Quality Gate 檢測細節**：

"

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1400`
- **實際:** `

**實際執行流程**：

1. **ASR 轉錄**：使用者說：「你有沒有過敏？」
2. **Fast Pass**（gpt-4.1-mini，1.0 秒）：翻譯為「Bạn có dị ứng không?」
3. **UI 顯示**：使用者看到 provisional 翻譯（標記 ⏳）
4. **shouldRunQualityPass()**：檢測到「過敏」關鍵詞與「沒有」否定詞 → 觸發 Quality Pass
5. **Quality Pass**（gpt-4o，1.5 秒）：翻譯為「Bạn có bị dị ứng không?」
6. **UI 回填**：同一 bubble 更新為 final 翻譯（標記 ✅）

**成本分析**：
- Fast Pass：$0.002 / 句
- Quality Pass：$0.008 / 句（僅觸發時）
- 觸發率：約 30-40%（醫療對話）
- 平均成本：$0.002 + $0.008 × 0.35 = $0.0048 / 句

---

#### 範例 5：Fast Pass 失敗 + Quality Pass 成功

**場景描述**：Fast Pass 翻譯品質不佳，Quality Gate 檢測到問題並觸發重試。

**執行流程**：

1. **ASR 轉錄**：「血壓 120/80 mmHg」
2. **Fast Pass**（gpt-4.1-mini）：翻譯為「Huyết áp 120/80」（遺漏 mmHg）
3. **Quality Gate 檢測**：
   - 檢測到數字遺漏（mmHg 未出現在譯文）
   - 嚴重程度：Critical
   - 建議動作：retry_quality
4. **Quality Pass 重試**（gpt-4o）：翻譯為「Huyết áp 120/80 mmHg」
5. **Quality Gate 再次檢測**：通過（數字單位完整）
6. **UI 顯示**：直接顯示 Quality Pass 結果（跳過 Fast Pass）

**Quality Gate 檢測細節**：

`
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 17. ⚠️ 可能的未知模型名稱: " 中的 allowlist 定義 |
| v1.6.0 | 2025-12-27 | Manus AI | 更新 ASR 模型支援；更新翻譯模型預設值；新增附錄 D 使用範例（9 個範例） |
| v1.5.0 | 2025-12-25 | Manus AI | 新增 3.4 節「Segment 執行期一致性規範」，補強即時字幕與 Final 翻譯的執行期行為約束 |
| v1.4.0 | 2025-12-25 | Manus AI | VAD/ASR 系統全面修復 |
| v1.0 | 2025-12-25 | Manus AI | 初始版本，包含完整設計規格 |

---

**文件結束**

---

## 附錄 A：已棄用模型

以下模型已不再建議使用，請使用新版模型替代：

### A.1 翻譯模型

**gpt-3.5-turbo** 系列模型（包含 "

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1550`
- **實際:** ` 中的 allowlist 定義 |
| v1.6.0 | 2025-12-27 | Manus AI | 更新 ASR 模型支援；更新翻譯模型預設值；新增附錄 D 使用範例（9 個範例） |
| v1.5.0 | 2025-12-25 | Manus AI | 新增 3.4 節「Segment 執行期一致性規範」，補強即時字幕與 Final 翻譯的執行期行為約束 |
| v1.4.0 | 2025-12-25 | Manus AI | VAD/ASR 系統全面修復 |
| v1.0 | 2025-12-25 | Manus AI | 初始版本，包含完整設計規格 |

---

**文件結束**

---

## 附錄 A：已棄用模型

以下模型已不再建議使用，請使用新版模型替代：

### A.1 翻譯模型

**gpt-3.5-turbo** 系列模型（包含 `
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

#### 18. ⚠️ 可能的未知模型名稱: "）已被 **gpt-4.1-mini** 取代。新版模型提供更好的翻譯品質、更快的回應速度，以及更優異的醫療術語處理能力。

**遷移建議：**
- 將所有 "

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1568`
- **實際:** `）已被 **gpt-4.1-mini** 取代。新版模型提供更好的翻譯品質、更快的回應速度，以及更優異的醫療術語處理能力。

**遷移建議：**
- 將所有 `
- **建議:** 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

## 📝 配置參數檢查

- **檢查檔案數:** 10
- **發現問題數:** 108
- **耗時:** 11ms

### 問題列表

#### 1. ⚠️ 文件中的參數 "minSpeechDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:112`
- **實際:** `minSpeechDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 2. ⚠️ 文件中的參數 "partialChunkMinBuffers" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:113`
- **實際:** `partialChunkMinBuffers`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 3. ⚠️ 文件中的參數 "partialChunkMinDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:114`
- **實際:** `partialChunkMinDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 4. ⚠️ 文件中的參數 "finalMinDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:115`
- **實際:** `finalMinDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 5. ⚠️ 文件中的參數 "finalMaxDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:116`
- **實際:** `finalMaxDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 6. ⚠️ 文件中的參數 "partialChunkMinBuffers" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:145`
- **實際:** `partialChunkMinBuffers`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 7. ⚠️ 文件中的參數 "partialChunkMinDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:146`
- **實際:** `partialChunkMinDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 8. ⚠️ 文件中的參數 "finalMinDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:147`
- **實際:** `finalMinDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 9. ⚠️ 文件中的參數 "finalMaxDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/BUG_FIX_REPORT_v1.5.2.md:148`
- **實際:** `finalMaxDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 10. ⚠️ 文件中的參數 "minSpeechDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/TEST_GITHUB_ACTIONS.md:35`
- **實際:** `minSpeechDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 11. ⚠️ 文件中的參數 "silenceDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/TEST_GITHUB_ACTIONS.md:36`
- **實際:** `silenceDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 12. ⚠️ 文件中的參數 "model" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:533`
- **實際:** `model`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 13. ⚠️ 文件中的參數 "language" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:534`
- **實際:** `language`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 14. ⚠️ 文件中的參數 "temperature" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:535`
- **實際:** `temperature`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 15. ⚠️ 文件中的參數 "responseformat" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:536`
- **實際:** `responseformat`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 16. ⚠️ 文件中的參數 "timestampgranularities" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:537`
- **實際:** `timestampgranularities`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 17. ⚠️ 文件中的參數 "model" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:557`
- **實際:** `model`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 18. ⚠️ 文件中的參數 "temperature" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:558`
- **實際:** `temperature`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 19. ⚠️ 文件中的參數 "maxtokens" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:559`
- **實際:** `maxtokens`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 20. ⚠️ 文件中的參數 "topp" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:560`
- **實際:** `topp`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 21. ⚠️ 文件中的參數 "frequencypenalty" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:561`
- **實際:** `frequencypenalty`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 22. ⚠️ 文件中的參數 "presencepenalty" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:562`
- **實際:** `presencepenalty`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 23. ⚠️ 文件中的參數 "responseformat" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:563`
- **實際:** `responseformat`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 24. ⚠️ 文件中的參數 "model" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:582`
- **實際:** `model`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 25. ⚠️ 文件中的參數 "voice" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:583`
- **實際:** `voice`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 26. ⚠️ 文件中的參數 "speed" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:584`
- **實際:** `speed`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 27. ⚠️ 文件中的參數 "responseformat" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:585`
- **實際:** `responseformat`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 28. ⚠️ 文件中的參數 "startThreshold" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:607`
- **實際:** `startThreshold`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 29. ⚠️ 文件中的參數 "endThreshold" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:608`
- **實際:** `endThreshold`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 30. ⚠️ 文件中的參數 "startFrames" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:609`
- **實際:** `startFrames`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 31. ⚠️ 文件中的參數 "endFrames" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:610`
- **實際:** `endFrames`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 32. ⚠️ 文件中的參數 "minPartialDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:611`
- **實際:** `minPartialDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 33. ⚠️ 文件中的參數 "minFinalDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:612`
- **實際:** `minFinalDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 34. ⚠️ 文件中的參數 "maxFinalDurationSec" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:613`
- **實際:** `maxFinalDurationSec`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 35. ⚠️ 文件中的參數 "partialWindowSec" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:614`
- **實際:** `partialWindowSec`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 36. ⚠️ 文件中的參數 "partialThrottleMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:615`
- **實際:** `partialThrottleMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 37. ⚠️ 文件中的參數 "id" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:643`
- **實際:** `id`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 38. ⚠️ 文件中的參數 "openId" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:644`
- **實際:** `openId`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 39. ⚠️ 文件中的參數 "name" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:645`
- **實際:** `name`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 40. ⚠️ 文件中的參數 "email" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:646`
- **實際:** `email`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 41. ⚠️ 文件中的參數 "loginMethod" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:647`
- **實際:** `loginMethod`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 42. ⚠️ 文件中的參數 "role" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:648`
- **實際:** `role`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 43. ⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:649`
- **實際:** `createdAt`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 44. ⚠️ 文件中的參數 "updatedAt" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:650`
- **實際:** `updatedAt`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 45. ⚠️ 文件中的參數 "lastSignedIn" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:651`
- **實際:** `lastSignedIn`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 46. ⚠️ 文件中的參數 "id" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:661`
- **實際:** `id`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 47. ⚠️ 文件中的參數 "userId" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:662`
- **實際:** `userId`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 48. ⚠️ 文件中的參數 "title" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:663`
- **實際:** `title`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 49. ⚠️ 文件中的參數 "sourceLanguage" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:664`
- **實際:** `sourceLanguage`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 50. ⚠️ 文件中的參數 "targetLanguage" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:665`
- **實際:** `targetLanguage`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 51. ⚠️ 文件中的參數 "asrModel" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:666`
- **實際:** `asrModel`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 52. ⚠️ 文件中的參數 "translationModel" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:667`
- **實際:** `translationModel`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 53. ⚠️ 文件中的參數 "ttsEnabled" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:668`
- **實際:** `ttsEnabled`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 54. ⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:669`
- **實際:** `createdAt`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 55. ⚠️ 文件中的參數 "updatedAt" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:670`
- **實際:** `updatedAt`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 56. ⚠️ 文件中的參數 "endedAt" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:671`
- **實際:** `endedAt`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 57. ⚠️ 文件中的參數 "id" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:681`
- **實際:** `id`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 58. ⚠️ 文件中的參數 "conversationId" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:682`
- **實際:** `conversationId`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 59. ⚠️ 文件中的參數 "segmentId" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:683`
- **實際:** `segmentId`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 60. ⚠️ 文件中的參數 "originalText" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:684`
- **實際:** `originalText`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 61. ⚠️ 文件中的參數 "translatedText" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:685`
- **實際:** `translatedText`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 62. ⚠️ 文件中的參數 "sourceLanguage" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:686`
- **實際:** `sourceLanguage`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 63. ⚠️ 文件中的參數 "targetLanguage" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:687`
- **實際:** `targetLanguage`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 64. ⚠️ 文件中的參數 "messageType" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:688`
- **實際:** `messageType`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 65. ⚠️ 文件中的參數 "asrDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:689`
- **實際:** `asrDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 66. ⚠️ 文件中的參數 "translationDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:690`
- **實際:** `translationDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 67. ⚠️ 文件中的參數 "ttsDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:691`
- **實際:** `ttsDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 68. ⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:692`
- **實際:** `createdAt`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 69. ⚠️ 文件中的參數 "id" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:702`
- **實際:** `id`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 70. ⚠️ 文件中的參數 "conversationId" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:703`
- **實際:** `conversationId`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 71. ⚠️ 文件中的參數 "messageId" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:704`
- **實際:** `messageId`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 72. ⚠️ 文件中的參數 "asrLatencyMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:705`
- **實際:** `asrLatencyMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 73. ⚠️ 文件中的參數 "translationLatencyMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:706`
- **實際:** `translationLatencyMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 74. ⚠️ 文件中的參數 "ttsLatencyMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:707`
- **實際:** `ttsLatencyMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 75. ⚠️ 文件中的參數 "e2eLatencyMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:708`
- **實際:** `e2eLatencyMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 76. ⚠️ 文件中的參數 "audioDurationMs" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:709`
- **實際:** `audioDurationMs`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 77. ⚠️ 文件中的參數 "audioBufferCount" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:710`
- **實際:** `audioBufferCount`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 78. ⚠️ 文件中的參數 "vadStartThreshold" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:711`
- **實際:** `vadStartThreshold`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 79. ⚠️ 文件中的參數 "vadEndThreshold" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:712`
- **實際:** `vadEndThreshold`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 80. ⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:713`
- **實際:** `createdAt`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 81. ⚠️ 文件中的參數 "ASR 延遲" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:957`
- **實際:** `ASR 延遲`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 82. ⚠️ 文件中的參數 "翻譯延遲" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:958`
- **實際:** `翻譯延遲`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 83. ⚠️ 文件中的參數 "TTS 延遲" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:959`
- **實際:** `TTS 延遲`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 84. ⚠️ 文件中的參數 "端到端延遲" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:960`
- **實際:** `端到端延遲`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 85. ⚠️ 文件中的參數 "Partial 更新頻率" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:961`
- **實際:** `Partial 更新頻率`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 86. ⚠️ 文件中的參數 "VAD 檢測延遲" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:962`
- **實際:** `VAD 檢測延遲`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 87. ⚠️ 文件中的參數 "ASR 準確率（WER）" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:980`
- **實際:** `ASR 準確率（WER）`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 88. ⚠️ 文件中的參數 "翻譯準確率（BLEU）" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:981`
- **實際:** `翻譯準確率（BLEU）`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 89. ⚠️ 文件中的參數 "VAD 準確率" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:982`
- **實際:** `VAD 準確率`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 90. ⚠️ 文件中的參數 "專業術語保留率" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:983`
- **實際:** `專業術語保留率`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 91. ⚠️ 文件中的參數 "系統可用性" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1001`
- **實際:** `系統可用性`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 92. ⚠️ 文件中的參數 "API 成功率" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1002`
- **實際:** `API 成功率`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 93. ⚠️ 文件中的參數 "Segment 取消率" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1003`
- **實際:** `Segment 取消率`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 94. ⚠️ 文件中的參數 "UI 更新錯誤率" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1004`
- **實際:** `UI 更新錯誤率`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 95. ⚠️ 文件中的參數 "記憶體洩漏率" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1005`
- **實際:** `記憶體洩漏率`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 96. ⚠️ 文件中的參數 "即時字幕流暢度" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1025`
- **實際:** `即時字幕流暢度`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 97. ⚠️ 文件中的參數 "翻譯自然度" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1026`
- **實際:** `翻譯自然度`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 98. ⚠️ 文件中的參數 "操作易用性" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1027`
- **實際:** `操作易用性`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 99. ⚠️ 文件中的參數 "錯誤恢復能力" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1028`
- **實際:** `錯誤恢復能力`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 100. ⚠️ 文件中的參數 "中文" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1216`
- **實際:** `中文`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 101. ⚠️ 文件中的參數 "英語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1217`
- **實際:** `英語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 102. ⚠️ 文件中的參數 "越南語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1218`
- **實際:** `越南語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 103. ⚠️ 文件中的參數 "印尼語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1219`
- **實際:** `印尼語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 104. ⚠️ 文件中的參數 "泰語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1220`
- **實際:** `泰語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 105. ⚠️ 文件中的參數 "日語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1221`
- **實際:** `日語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 106. ⚠️ 文件中的參數 "韓語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1222`
- **實際:** `韓語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 107. ⚠️ 文件中的參數 "菲律賓語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1223`
- **實際:** `菲律賓語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

#### 108. ⚠️ 文件中的參數 "緬甸語" 未在 config.ts 中找到

- **檔案:** `docs/realtime-subtitle-translation-spec.md:1224`
- **實際:** `緬甸語`
- **建議:** 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

## 📝 檔案路徑檢查

- **檢查檔案數:** 10
- **發現問題數:** 17
- **耗時:** 38ms

### 問題列表

#### 1. ❌ 引用的檔案不存在: "scripts/doc-check.ts"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:117`
- **實際:** `scripts/doc-check.ts`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 2. ❌ 引用的檔案不存在: "docs/example.md"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:308`
- **實際:** `docs/example.md`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 3. ℹ️ 引用的行號指向空行: "docs/ARCHITECTURE-v2.0.md:456"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:475`
- **實際:** `456`
- **建議:** 請檢查行號引用是否正確

#### 4. ❌ 引用的檔案不存在: "docs/check-report.md"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:582`
- **實際:** `docs/check-report.md`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 5. ❌ 引用的檔案不存在: "docs/check-report.md"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:590`
- **實際:** `docs/check-report.md`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 6. ❌ 引用的檔案不存在: "scripts/doc-check/check-state-machines.ts"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:614`
- **實際:** `scripts/doc-check/check-state-machines.ts`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 7. ❌ 引用的檔案不存在: "scripts/doc-check/check-state-machines.ts"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:615`
- **實際:** `scripts/doc-check/check-state-machines.ts`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 8. ❌ 引用的檔案不存在: "scripts/doc-check/check-api.ts"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:618`
- **實際:** `scripts/doc-check/check-api.ts`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 9. ❌ 引用的檔案不存在: "scripts/doc-check/check-api.ts"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:619`
- **實際:** `scripts/doc-check/check-api.ts`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 10. ❌ 引用的檔案不存在: "scripts/doc-check.sh"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:642`
- **實際:** `scripts/doc-check.sh`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 11. ℹ️ 引用的行號指向空行: "docs/ARCHITECTURE-v2.0.md:456"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:694`
- **實際:** `456`
- **建議:** 請檢查行號引用是否正確

#### 12. ❌ 引用的檔案不存在: "docs/API_REFERENCE.md"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:719`
- **實際:** `docs/API_REFERENCE.md`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 13. ❌ 引用的檔案不存在: "scripts/doc-check.ts"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:108`
- **實際:** `scripts/doc-check.ts`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 14. ❌ 引用的檔案不存在: "docs/example.md"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:308`
- **實際:** `docs/example.md`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 15. ℹ️ 引用的行號指向空行: "docs/ARCHITECTURE-v2.0.md:456"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:475`
- **實際:** `456`
- **建議:** 請檢查行號引用是否正確

#### 16. ❌ 引用的檔案不存在: "scripts/doc-check.sh"

- **檔案:** `docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:639`
- **實際:** `scripts/doc-check.sh`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

#### 17. ❌ 引用的檔案不存在: "4.5/5.0"

- **檔案:** `docs/realtime-subtitle-translation-spec.md:988`
- **實際:** `4.5/5.0`
- **建議:** 請檢查檔案路徑是否正確，或移除此引用

## 結論

❌ **發現 17 個錯誤，請修正後再次檢查**