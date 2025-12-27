🔍 開始執行文件檢查...

📝 執行模型名稱檢查...
✓ 從 config.ts 提取到 9 個模型定義
  - ASR 模型: whisper-1, gpt-4o-mini-transcribe, gpt-4o-transcribe, gpt-4o-transcribe-diarize, gpt-4o-realtime-preview
  - 翻譯模型: gpt-4o-mini, gpt-4.1-mini, gpt-4.1, gpt-4o
✓ 掃描到 10 個 Markdown 檔案
✓ 完成 (27 個問題)

📝 執行配置參數檢查...
✓ 從 config.ts 提取到 0 個配置參數
✓ 掃描到 10 個 Markdown 檔案
✓ 完成 (108 個問題)

📝 執行檔案路徑檢查...
✓ 掃描到 10 個 Markdown 檔案
✓ 找到 87 個檔案路徑引用
✓ 完成 (15 個問題)


================================================================================
📋 文件檢查報告
================================================================================

📊 檢查摘要
--------------------------------------------------------------------------------
檢查時間: 2025-12-27T08:16:09.408Z
總檔案數: 10
總問題數: 150
  - 錯誤 (❌): 21
  - 警告 (⚠️): 126
  - 資訊 (ℹ️): 3
總耗時: 101ms


================================================================================
📝 模型名稱檢查
================================================================================
檢查檔案數: 10
發現問題數: 27
耗時: 37ms

問題列表:
--------------------------------------------------------------------------------

⚠️ 可能的未知模型名稱: "
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
   檔案: docs/ARCHITECTURE-v2.0.md:20
   實際: 
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

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "

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
   檔案: docs/ARCHITECTURE-v2.0.md:353
   實際: 

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


   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

❌ 未知的模型名稱: "gpt-3.5-turbo"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:301
   實際: gpt-3.5-turbo
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

❌ 未知的模型名稱: "gpt-3.5-turbo"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:668
   實際: gpt-3.5-turbo
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

❌ 未知的模型名稱: "gpt-3.5-turbo"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:671
   實際: gpt-3.5-turbo
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

❌ 未知的模型名稱: "gpt-3.5-turbo"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:760
   實際: gpt-3.5-turbo
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

⚠️ 可能的未知模型名稱: "gpt-3.5-turbo"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:38
   實際: gpt-3.5-turbo
   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "
❌ docs/realtime-subtitle-translation-spec.md:534
   Invalid ASR model: "gpt-3.5-turbo"
   
   Valid models:
   - whisper-1
   - gpt-4o-mini-transcribe
   - gpt-4o-transcribe
   - gpt-4o-transcribe-diarize
   
   Suggestion: Replace with "gpt-4.1-mini" (for translation) or "gpt-4o-mini-transcribe" (for ASR)
"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:299
   實際: 
❌ docs/realtime-subtitle-translation-spec.md:534
   Invalid ASR model: "gpt-3.5-turbo"
   
   Valid models:
   - whisper-1
   - gpt-4o-mini-transcribe
   - gpt-4o-transcribe
   - gpt-4o-transcribe-diarize
   
   Suggestion: Replace with "gpt-4.1-mini" (for translation) or "gpt-4o-mini-transcribe" (for ASR)

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "
❌ docs/realtime-subtitle-translation-spec.md:556
   Parameter "model" default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Suggestion: Update table cell to "gpt-4.1-mini"
"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:339
   實際: 
❌ docs/realtime-subtitle-translation-spec.md:556
   Parameter "model" default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Suggestion: Update table cell to "gpt-4.1-mini"

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "  
**Severity**: 🔴 Critical

**Problem**: Document references deprecated model "gpt-3.5-turbo"

**Expected**: One of "
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:757
   實際:   
**Severity**: 🔴 Critical

**Problem**: Document references deprecated model "gpt-3.5-turbo"

**Expected**: One of 
   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

❌ 未知的模型名稱: "GPT-4o Mini"
   檔案: docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:34
   實際: GPT-4o Mini
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

❌ 未知的模型名稱: "GPT-4o"
   檔案: docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:35
   實際: GPT-4o
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

❌ 未知的模型名稱: "GPT-4o Diarize"
   檔案: docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:36
   實際: GPT-4o Diarize
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

❌ 未知的模型名稱: "GPT-4o Mini"
   檔案: docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:60
   實際: GPT-4o Mini
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

❌ 未知的模型名稱: "GPT-4o"
   檔案: docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:63
   實際: GPT-4o
   建議: 請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱

⚠️ 可能的未知模型名稱: "typescript
WHISPER_CONFIG.AVAILABLE_MODELS = [
  { value: "whisper-1", label: "Whisper-1" },
  { value: "gpt-4o-mini-transcribe", label: "GPT-4o Mini" },
  { value: "gpt-4o-transcribe", label: "GPT-4o" },
  { value: "gpt-4o-transcribe-diarize", label: "GPT-4o Diarize" }
]
"
   檔案: docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:31
   實際: typescript
WHISPER_CONFIG.AVAILABLE_MODELS = [
  { value: "whisper-1", label: "Whisper-1" },
  { value: "gpt-4o-mini-transcribe", label: "GPT-4o Mini" },
  { value: "gpt-4o-transcribe", label: "GPT-4o" },
  { value: "gpt-4o-transcribe-diarize", label: "GPT-4o Diarize" }
]

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "typescript
TRANSLATION_CONFIG.LLM_MODEL = "gpt-4.1-mini"
TRANSLATION_CONFIG.AVAILABLE_TRANSLATION_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" }, // 預設
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4o", name: "GPT-4o" }
]
"
   檔案: docs/DOCUMENTATION_CONSISTENCY_AUDIT.md:57
   實際: typescript
TRANSLATION_CONFIG.LLM_MODEL = "gpt-4.1-mini"
TRANSLATION_CONFIG.AVAILABLE_TRANSLATION_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" }, // 預設
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4o", name: "GPT-4o" }
]

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "

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

"
   檔案: docs/QUALITY_GATE.md:175
   實際: 

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


   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "
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
"
   檔案: docs/QUALITY_GATE.md:271
   實際: 
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

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: " |

**模型選擇建議**如下：

**whisper-1** 為基礎模型，提供穩定的轉錄品質與較低的 API 成本。適用於一般對話場景，延遲約 2.5-3.5 秒。該模型支援多語言轉錄，但不支援即時串流輸出。

**gpt-4o-mini-transcribe** 為快速轉錄模型（**系統預設**），提供最佳的速度與成本平衡。適用於即時對話場景，延遲約 1.5-2.5 秒。該模型在保持良好轉錄品質的同時大幅降低 API 成本，是大多數場景的最佳選擇。

**gpt-4o-transcribe** 為高品質轉錄模型，提供更高的轉錄準確度與更好的雜訊抑制能力。適用於複雜對話場景與醫療專業場景，延遲約 2.0-3.0 秒。該模型在專業術語識別與口音適應上表現優異。

**gpt-4o-transcribe-diarize** 為進階轉錄模型，在 "
   檔案: docs/realtime-subtitle-translation-spec.md:538
   實際:  |

**模型選擇建議**如下：

**whisper-1** 為基礎模型，提供穩定的轉錄品質與較低的 API 成本。適用於一般對話場景，延遲約 2.5-3.5 秒。該模型支援多語言轉錄，但不支援即時串流輸出。

**gpt-4o-mini-transcribe** 為快速轉錄模型（**系統預設**），提供最佳的速度與成本平衡。適用於即時對話場景，延遲約 1.5-2.5 秒。該模型在保持良好轉錄品質的同時大幅降低 API 成本，是大多數場景的最佳選擇。

**gpt-4o-transcribe** 為高品質轉錄模型，提供更高的轉錄準確度與更好的雜訊抑制能力。適用於複雜對話場景與醫療專業場景，延遲約 2.0-3.0 秒。該模型在專業術語識別與口音適應上表現優異。

**gpt-4o-transcribe-diarize** 為進階轉錄模型，在 
   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: " | 結構化輸出格式 | JSON Schema 定義 |

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
   檔案: docs/realtime-subtitle-translation-spec.md:562
   實際:  | 結構化輸出格式 | JSON Schema 定義 |

**模型選擇建議**如下：

**gpt-4o** 為旗艦模型，提供最高的翻譯品質與最佳的專業術語處理能力。適用於醫療場景與高品質要求場景（Quality Pass），延遲約 1.0-1.5 秒。該模型支援複雜句式翻譯與文化適應性調整，是兩段式翻譯流程中 Quality Pass 的預設選擇。

**gpt-4.1-mini** 為快速翻譯模型（**系統預設**），提供最佳的速度與品質平衡。適用於即時翻譯場景（Fast Pass），延遲約 0.8-1.2 秒。該模型在保持良好翻譯品質的同時提供快速回應，是兩段式翻譯流程中 Fast Pass 的預設選擇。

**gpt-4.1** 為高品質翻譯模型，提供優異的翻譯品質與專業術語處理能力。適用於進階翻譯場景，延遲約 1.2-1.8 秒。該模型在醫療術語翻譯與文化適應性上表現優異，可作為 Quality Pass 的替代選擇。

**gpt-4o-mini** 為輕量模型，在保持高品質的同時大幅降低延遲與成本。適用於一般對話場景，延遲約 0.8-1.3 秒。該模型提供良好的效能與成本平衡，可作為 Fast Pass 的替代選擇（非預設模型）。


### 4.3 TTS 參數

系統整合 OpenAI TTS API 提供語音合成功能，支援多種語音與語速調整。

| 參數名稱 | 資料型別 | 預設值 | 說明 | 可選值 |
|---------|---------|--------|------|--------|
| 
   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "typescript
// shared/config.ts
WHISPER_CONFIG.MODEL = "gpt-4o-mini-transcribe";
"
   檔案: docs/realtime-subtitle-translation-spec.md:1294
   實際: typescript
// shared/config.ts
WHISPER_CONFIG.MODEL = "gpt-4o-mini-transcribe";

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "typescript
// shared/config.ts
WHISPER_CONFIG.MODEL = "gpt-4o-transcribe";
"
   檔案: docs/realtime-subtitle-translation-spec.md:1318
   實際: typescript
// shared/config.ts
WHISPER_CONFIG.MODEL = "gpt-4o-transcribe";

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "typescript
// shared/config.ts
WHISPER_CONFIG.MODEL = "gpt-4o-transcribe-diarize";
"
   檔案: docs/realtime-subtitle-translation-spec.md:1342
   實際: typescript
// shared/config.ts
WHISPER_CONFIG.MODEL = "gpt-4o-transcribe-diarize";

   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "

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
   檔案: docs/realtime-subtitle-translation-spec.md:1395
   實際: 

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


   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "

**成本**：$0.002 + $0.008 = $0.010

**效益**：Quality Pass 修正了單位顯示（度 → ℃）

---

#### 範例 9：成本控制統計

**場景**：100 句對話，其中 35 句觸發 Quality Pass

**成本計算**：
- Fast Pass：100 句 × $0.002 = $0.20
- Quality Pass：35 句 × $0.008 = $0.28
- **總成本**：$0.48

**對比全部使用 Quality Pass**：
- 全部 Quality Pass：100 句 × $0.008 = $0.80
- **節省**：$0.80 - $0.48 = $0.32（40% 成本降低）

**品質保證**：
- 關鍵句子（醫療術語、數字單位、否定詞）：100% Quality Pass
- 一般句子：Fast Pass（品質也很好）

---

## 版本歷史

| 版本 | 日期 | 作者 | 變更說明 |
|-----|------|------|------|
| v1.6.0 | 2025-12-27 | Manus AI | 更新 ASR 模型名稱（gpt-4o-mini-transcribe, gpt-4o-transcribe, gpt-4o-transcribe-diarize）；更新翻譯模型預設值（gpt-4.1-mini）；新增附錄 D 使用範例（9 個範例） |
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
   檔案: docs/realtime-subtitle-translation-spec.md:1514
   實際: 

**成本**：$0.002 + $0.008 = $0.010

**效益**：Quality Pass 修正了單位顯示（度 → ℃）

---

#### 範例 9：成本控制統計

**場景**：100 句對話，其中 35 句觸發 Quality Pass

**成本計算**：
- Fast Pass：100 句 × $0.002 = $0.20
- Quality Pass：35 句 × $0.008 = $0.28
- **總成本**：$0.48

**對比全部使用 Quality Pass**：
- 全部 Quality Pass：100 句 × $0.008 = $0.80
- **節省**：$0.80 - $0.48 = $0.32（40% 成本降低）

**品質保證**：
- 關鍵句子（醫療術語、數字單位、否定詞）：100% Quality Pass
- 一般句子：Fast Pass（品質也很好）

---

## 版本歷史

| 版本 | 日期 | 作者 | 變更說明 |
|-----|------|------|------|
| v1.6.0 | 2025-12-27 | Manus AI | 更新 ASR 模型名稱（gpt-4o-mini-transcribe, gpt-4o-transcribe, gpt-4o-transcribe-diarize）；更新翻譯模型預設值（gpt-4.1-mini）；新增附錄 D 使用範例（9 個範例） |
| v1.5.0 | 2025-12-25 | Manus AI | 新增 3.4 節「Segment 執行期一致性規範」，補強即時字幕與 Final 翻譯的執行期行為約束 |
| v1.4.0 | 2025-12-25 | Manus AI | VAD/ASR 系統全面修復 |
| v1.0 | 2025-12-25 | Manus AI | 初始版本，包含完整設計規格 |

---

**文件結束**

---

## 附錄 A：已棄用模型

以下模型已不再建議使用，請使用新版模型替代：

### A.1 翻譯模型

**gpt-3.5-turbo** 系列模型（包含 
   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

⚠️ 可能的未知模型名稱: "）已被 **gpt-4.1-mini** 取代。新版模型提供更好的翻譯品質、更快的回應速度，以及更優異的醫療術語處理能力。

**遷移建議：**
- 將所有 "
   檔案: docs/realtime-subtitle-translation-spec.md:1562
   實際: ）已被 **gpt-4.1-mini** 取代。新版模型提供更好的翻譯品質、更快的回應速度，以及更優異的醫療術語處理能力。

**遷移建議：**
- 將所有 
   建議: 如果這是模型名稱，請檢查 shared/config.ts 中是否定義

================================================================================
📝 配置參數檢查
================================================================================
檢查檔案數: 10
發現問題數: 108
耗時: 21ms

問題列表:
--------------------------------------------------------------------------------

⚠️ 文件中的參數 "minSpeechDurationMs" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:112
   實際: minSpeechDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "partialChunkMinBuffers" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:113
   實際: partialChunkMinBuffers
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "partialChunkMinDurationMs" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:114
   實際: partialChunkMinDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "finalMinDurationMs" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:115
   實際: finalMinDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "finalMaxDurationMs" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:116
   實際: finalMaxDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "partialChunkMinBuffers" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:145
   實際: partialChunkMinBuffers
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "partialChunkMinDurationMs" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:146
   實際: partialChunkMinDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "finalMinDurationMs" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:147
   實際: finalMinDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "finalMaxDurationMs" 未在 config.ts 中找到
   檔案: docs/BUG_FIX_REPORT_v1.5.2.md:148
   實際: finalMaxDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "minSpeechDurationMs" 未在 config.ts 中找到
   檔案: docs/TEST_GITHUB_ACTIONS.md:35
   實際: minSpeechDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "silenceDurationMs" 未在 config.ts 中找到
   檔案: docs/TEST_GITHUB_ACTIONS.md:36
   實際: silenceDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "model" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:533
   實際: model
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "language" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:534
   實際: language
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "temperature" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:535
   實際: temperature
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "responseformat" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:536
   實際: responseformat
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "timestampgranularities" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:537
   實際: timestampgranularities
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "model" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:555
   實際: model
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "temperature" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:556
   實際: temperature
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "maxtokens" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:557
   實際: maxtokens
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "topp" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:558
   實際: topp
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "frequencypenalty" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:559
   實際: frequencypenalty
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "presencepenalty" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:560
   實際: presencepenalty
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "responseformat" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:561
   實際: responseformat
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "model" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:580
   實際: model
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "voice" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:581
   實際: voice
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "speed" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:582
   實際: speed
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "responseformat" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:583
   實際: responseformat
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "startThreshold" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:605
   實際: startThreshold
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "endThreshold" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:606
   實際: endThreshold
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "startFrames" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:607
   實際: startFrames
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "endFrames" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:608
   實際: endFrames
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "minPartialDurationMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:609
   實際: minPartialDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "minFinalDurationMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:610
   實際: minFinalDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "maxFinalDurationSec" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:611
   實際: maxFinalDurationSec
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "partialWindowSec" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:612
   實際: partialWindowSec
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "partialThrottleMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:613
   實際: partialThrottleMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "id" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:641
   實際: id
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "openId" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:642
   實際: openId
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "name" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:643
   實際: name
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "email" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:644
   實際: email
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "loginMethod" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:645
   實際: loginMethod
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "role" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:646
   實際: role
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:647
   實際: createdAt
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "updatedAt" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:648
   實際: updatedAt
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "lastSignedIn" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:649
   實際: lastSignedIn
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "id" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:659
   實際: id
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "userId" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:660
   實際: userId
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "title" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:661
   實際: title
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "sourceLanguage" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:662
   實際: sourceLanguage
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "targetLanguage" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:663
   實際: targetLanguage
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "asrModel" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:664
   實際: asrModel
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "translationModel" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:665
   實際: translationModel
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "ttsEnabled" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:666
   實際: ttsEnabled
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:667
   實際: createdAt
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "updatedAt" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:668
   實際: updatedAt
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "endedAt" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:669
   實際: endedAt
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "id" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:679
   實際: id
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "conversationId" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:680
   實際: conversationId
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "segmentId" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:681
   實際: segmentId
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "originalText" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:682
   實際: originalText
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "translatedText" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:683
   實際: translatedText
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "sourceLanguage" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:684
   實際: sourceLanguage
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "targetLanguage" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:685
   實際: targetLanguage
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "messageType" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:686
   實際: messageType
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "asrDurationMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:687
   實際: asrDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "translationDurationMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:688
   實際: translationDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "ttsDurationMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:689
   實際: ttsDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:690
   實際: createdAt
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "id" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:700
   實際: id
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "conversationId" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:701
   實際: conversationId
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "messageId" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:702
   實際: messageId
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "asrLatencyMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:703
   實際: asrLatencyMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "translationLatencyMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:704
   實際: translationLatencyMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "ttsLatencyMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:705
   實際: ttsLatencyMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "e2eLatencyMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:706
   實際: e2eLatencyMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "audioDurationMs" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:707
   實際: audioDurationMs
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "audioBufferCount" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:708
   實際: audioBufferCount
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "vadStartThreshold" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:709
   實際: vadStartThreshold
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "vadEndThreshold" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:710
   實際: vadEndThreshold
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "createdAt" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:711
   實際: createdAt
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "ASR 延遲" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:955
   實際: ASR 延遲
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "翻譯延遲" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:956
   實際: 翻譯延遲
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "TTS 延遲" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:957
   實際: TTS 延遲
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "端到端延遲" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:958
   實際: 端到端延遲
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "Partial 更新頻率" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:959
   實際: Partial 更新頻率
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "VAD 檢測延遲" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:960
   實際: VAD 檢測延遲
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "ASR 準確率（WER）" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:978
   實際: ASR 準確率（WER）
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "翻譯準確率（BLEU）" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:979
   實際: 翻譯準確率（BLEU）
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "VAD 準確率" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:980
   實際: VAD 準確率
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "專業術語保留率" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:981
   實際: 專業術語保留率
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "系統可用性" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:999
   實際: 系統可用性
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "API 成功率" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1000
   實際: API 成功率
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "Segment 取消率" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1001
   實際: Segment 取消率
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "UI 更新錯誤率" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1002
   實際: UI 更新錯誤率
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "記憶體洩漏率" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1003
   實際: 記憶體洩漏率
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "即時字幕流暢度" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1023
   實際: 即時字幕流暢度
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "翻譯自然度" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1024
   實際: 翻譯自然度
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "操作易用性" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1025
   實際: 操作易用性
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "錯誤恢復能力" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1026
   實際: 錯誤恢復能力
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "中文" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1214
   實際: 中文
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "英語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1215
   實際: 英語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "越南語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1216
   實際: 越南語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "印尼語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1217
   實際: 印尼語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "泰語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1218
   實際: 泰語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "日語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1219
   實際: 日語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "韓語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1220
   實際: 韓語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "菲律賓語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1221
   實際: 菲律賓語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

⚠️ 文件中的參數 "緬甸語" 未在 config.ts 中找到
   檔案: docs/realtime-subtitle-translation-spec.md:1222
   實際: 緬甸語
   建議: 請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義

================================================================================
📝 檔案路徑檢查
================================================================================
檢查檔案數: 10
發現問題數: 15
耗時: 43ms

問題列表:
--------------------------------------------------------------------------------

❌ 引用的檔案不存在: "scripts/doc-check.ts"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:114
   實際: scripts/doc-check.ts
   建議: 請檢查檔案路徑是否正確，或移除此引用

ℹ️ 引用的行號指向空行: "docs/ARCHITECTURE-v2.0.md:456"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:466
   實際: 456
   建議: 請檢查行號引用是否正確

❌ 引用的檔案不存在: "docs/check-report.md"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:573
   實際: docs/check-report.md
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "docs/check-report.md"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:581
   實際: docs/check-report.md
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "scripts/doc-check/check-state-machines.ts"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:605
   實際: scripts/doc-check/check-state-machines.ts
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "scripts/doc-check/check-state-machines.ts"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:606
   實際: scripts/doc-check/check-state-machines.ts
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "scripts/doc-check/check-api.ts"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:609
   實際: scripts/doc-check/check-api.ts
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "scripts/doc-check/check-api.ts"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:610
   實際: scripts/doc-check/check-api.ts
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "scripts/doc-check.sh"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:633
   實際: scripts/doc-check.sh
   建議: 請檢查檔案路徑是否正確，或移除此引用

ℹ️ 引用的行號指向空行: "docs/ARCHITECTURE-v2.0.md:456"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:686
   實際: 456
   建議: 請檢查行號引用是否正確

❌ 引用的檔案不存在: "docs/API_REFERENCE.md"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:711
   實際: docs/API_REFERENCE.md
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "scripts/doc-check.ts"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:105
   實際: scripts/doc-check.ts
   建議: 請檢查檔案路徑是否正確，或移除此引用

ℹ️ 引用的行號指向空行: "docs/ARCHITECTURE-v2.0.md:456"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:466
   實際: 456
   建議: 請檢查行號引用是否正確

❌ 引用的檔案不存在: "scripts/doc-check.sh"
   檔案: docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md:630
   實際: scripts/doc-check.sh
   建議: 請檢查檔案路徑是否正確，或移除此引用

❌ 引用的檔案不存在: "4.5/5.0"
   檔案: docs/realtime-subtitle-translation-spec.md:986
   實際: 4.5/5.0
   建議: 請檢查檔案路徑是否正確，或移除此引用

================================================================================
❌ 發現 21 個錯誤，請修正後再次檢查
================================================================================

================================================================================
檢查完成: 10 個檔案
發現問題: 150 個 (錯誤: 21, 警告: 126, 資訊: 3)
總耗時: 101ms
❌ 發現 21 個錯誤
================================================================================
