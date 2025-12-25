# 架構設計文件 - v2.0.0

## 概述

本文件描述即時雙向翻譯系統 v2.0.0 的架構設計，重點在於「醫護品質最優方案」（方案2）的實作細節。

## 核心目標

1. **即時字幕/即時翻譯可用（Fast Pass）**：1-2 秒內顯示 provisional 翻譯
2. **句尾定稿以高品質回填修正（Quality Pass）**：3-6 秒內回填醫療級定稿
3. **醫療情境品質保證**：
   - 不能亂加資訊
   - 不能漏數字/單位/否定詞
   - 術語一致

## 系統架構

### 1. 兩段式翻譯流程（Two-Pass Translation）

```
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
```

### 2. 資料結構

#### ConversationMessage

```typescript
type ConversationMessage = {
  id: number;
  speaker: "nurse" | "patient";
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  timestamp: Date;
  status: "partial" | "final" | "translated";
  
  // 兩段式翻譯欄位
  translationStage?: "provisional" | "final"; // provisional: Fast Pass, final: Quality Pass
  qualityPassStatus?: "pending" | "processing" | "completed" | "failed"; // Quality Pass 狀態
  sourceLang?: string; // 原文語言
  targetLang?: string; // 目標語言
};
```

#### ConversationContext

```typescript
interface ConversationContext {
  speaker: "nurse" | "patient";
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText?: string;
  timestamp: Date;
}
```

### 3. Glossary 術語字典

#### 資料結構

```typescript
interface GlossaryEntry {
  zh: string;          // 中文原文
  vi: string;          // 越南語翻譯
  id?: string;         // 印尼語翻譯（可選）
  fil?: string;        // 菲律賓語翻譯（可選）
  en?: string;         // 英文翻譯（可選）
  category: "vital_signs" | "symptoms" | "medications" | "conditions" | "procedures" | "body_parts" | "time_units" | "negations";
  note?: string;       // 備註說明
}
```

#### 術語分類

1. **vital_signs（生命徵象）**：BP/血壓、HR/心跳、SpO2/血氧、體溫等
2. **symptoms（症狀）**：疼痛、噁心、頭暈等
3. **medications（藥物）**：止痛藥、抗生素等
4. **conditions（疾病狀況）**：糖尿病、高血壓、過敏、懷孕、哺乳等
5. **procedures（醫療程序）**：打針、抽血等
6. **body_parts（身體部位）**：頭、胸、腹等
7. **time_units（時間單位）**：天、週、次等
8. **negations（否定詞）**：不、沒有、未、別等

#### 保護單位

```typescript
const PROTECTED_UNITS = [
  // 藥物劑量單位
  "mg", "g", "kg",
  "ml", "cc", "L",
  
  // 生命徵象單位
  "mmHg",
  "℃", "°C",
  "bpm", "次/分",
  "%",
  
  // 時間單位
  "天", "週", "月", "年",
  "小時", "分鐘", "秒",
  "次", "回",
];
```

### 4. Quality Gate 品質守門機制

#### 檢查規則

1. **數字遺漏檢測**
   - 原文包含數字但譯文沒有數字 → Critical
   - 部分數字未出現在譯文中 → High

2. **否定詞反轉檢測**
   - 原文有否定詞但譯文疑似缺少否定詞 → Critical
   - 使用目標語言的否定詞模式進行檢測

3. **長度異常檢測**
   - 譯文長度過短（< 0.3 倍原文）→ Medium
   - 譯文長度過長（> 5 倍原文）→ Medium

4. **空白翻譯檢測**
   - 翻譯結果為空 → Critical

5. **相同文字檢測**
   - 翻譯與原文完全相同 → High

6. **可疑內容檢測**
   - 包含方括號、花括號、HTML 標籤等 → Medium

#### 品質分數

- 初始分數：100
- 根據問題嚴重程度扣分：
  - Critical: -40 分
  - High: -30 分
  - Medium: -15 分
  - Low: -5 分
- 通過門檻：70 分

#### 建議動作

```typescript
type Recommendation = "accept" | "retry_fast" | "retry_quality";

// 分數 >= 70 → accept
// 分數 < 70 且有 critical 問題 → retry_quality
// 分數 < 70 且只有 medium/low 問題 → retry_fast
```

### 5. Prompt 模板

#### Fast Pass Prompt

```
你是專業的醫療翻譯助手。請將以下對話翻譯成${targetLang}。

說話者：${roleDescription}
原文語言：${sourceLang}
目標語言：${targetLang}

原文：
${sourceText}

翻譯要求：
1. 忠實翻譯，不可自行添加或省略資訊
2. 保留所有數字和單位（如：120/80 mmHg, 38.5℃, 500mg）
3. 保留否定詞（不、沒有、未、別）
4. 使用簡單易懂的語言
5. 只輸出翻譯結果，不要解釋

翻譯：
```

#### Quality Pass Prompt

```
你是專業的醫療翻譯專家。請將以下對話翻譯成${targetLang}。

說話者：${roleDescription}
原文語言：${sourceLang}
目標語言：${targetLang}

對話上下文（最近 ${context.length} 句）：
${context}

原文：
${sourceText}

醫療翻譯規則（必須嚴格遵守）：
1. **忠實翻譯原則**
   - 不可自行添加診斷、建議或背景資訊
   - 不可省略任何原文內容
   - 若原文不完整或語意不明，保持原文風格，不要擅自補充

2. **數字與單位保護**
   - 所有數字必須完整保留
   - 所有單位必須完整保留
   - 數字與單位的組合不可拆散

3. **否定詞保護**
   - 否定詞不可遺漏或反轉

4. **術語一致性**
   ${glossary}
   - 必須使用上述術語對照表的翻譯

5. **語言風格**
   - 使用簡單、清晰、易懂的語言

6. **輸出格式**
   - 只輸出翻譯結果

翻譯：
```

### 6. tRPC API 設計

#### translate.fastPass

```typescript
input: {
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  speakerRole: "nurse" | "patient";
}

output: {
  success: boolean;
  translatedText: string;
  model: string;
  duration: number;
  qualityCheck?: QualityCheckResult;
}
```

#### translate.qualityPass

```typescript
input: {
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  speakerRole: "nurse" | "patient";
  context?: ConversationContext[];
  maxRetries?: number;
}

output: {
  success: boolean;
  translatedText: string;
  model: string;
  duration: number;
  qualityCheck: QualityCheckResult;
  retryCount: number;
}
```

## 實作細節

### 1. 分段策略調整

#### 問題

- 原先 final hard-trim 只取最後 2 秒，會丟前文
- 導致翻譯缺前文（只翻到後半句）

#### 解決方案

- 保留本句完整 transcript（文字層）再翻譯
- 不要只靠最後 2 秒音訊
- 若後端限制音訊長度：做「多段 ASR → 文字合併 → 翻譯」

### 2. VAD 設定 UI 移除

#### 已完成（v1.5.4）

- 從 Settings.tsx 移除所有 VAD 相關 UI
- 清理 localStorage 舊 VAD 值
- VAD 參數只從 config 讀取
- 允許 env 覆寫 VAD 參數（但不提供 UI）

### 3. 上下文管理

#### Context 收集

```typescript
// 收集最近 3-6 句對話
const context: ConversationContext[] = conversations
  .filter(msg => msg.status === "translated")
  .filter(msg => msg.speaker === currentSpeaker) // 同方向
  .slice(-6) // 最近 6 句
  .map(msg => ({
    speaker: msg.speaker,
    sourceLang: msg.sourceLang || "zh",
    targetLang: msg.targetLang || "vi",
    sourceText: msg.originalText,
    translatedText: msg.translatedText,
    timestamp: msg.timestamp,
  }));
```

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

```
realtime-translation/
├── shared/
│   ├── config.ts                    # 系統配置（VAD, ASR, Translation）
│   ├── glossary.ts                  # 醫療術語字典
│   ├── qualityGate.ts               # 品質守門機制
│   └── translationPrompts.ts        # Prompt 模板
├── server/
│   ├── routers.ts                   # tRPC routers（含 fastPass, qualityPass）
│   ├── twoPassTranslation.ts        # 兩段式翻譯服務
│   ├── translationService.ts        # 原有翻譯服務
│   └── _core/
│       └── llm.ts                   # LLM 呼叫介面
├── client/src/
│   └── pages/
│       └── Home.tsx                 # 前端主頁（含 ConversationMessage 定義）
└── docs/
    ├── ARCHITECTURE-v2.0.md         # 本文件
    ├── MEDICAL_GLOSSARY.md          # 術語字典文件
    └── QUALITY_GATE.md              # 品質守門機制文件
```

## 未來改進

1. **動態 Glossary**
   - 允許使用者自訂術語
   - 從對話中學習術語

2. **Context 優化**
   - 智慧選擇相關 context（不只最近 N 句）
   - 跨 session 的 context 記憶

3. **Quality Gate 強化**
   - 使用 LLM 進行語義檢查
   - 更精確的否定詞檢測

4. **效能優化**
   - Fast Pass 與 Quality Pass 並行執行
   - 使用 streaming API 降低延遲

5. **多語言支援**
   - 擴展 glossary 到更多語言
   - 支援多語言混合對話

## 版本歷史

- **v2.0.0**（2025-12-25）：醫護品質最優方案（方案2）
  - 實作兩段式翻譯流程
  - 實作 Glossary 術語字典
  - 實作 Quality Gate 守門機制
  - 實作上下文注入
  - 調整分段策略
  - 移除 VAD 設定 UI

- **v1.5.4**（2025-12-25）：VAD 設定 UI 移除
- **v1.5.3**（2025-12-25）：VAD/Segmenter 改進
- **v1.5.2**（2025-12-25）：參數優化
- **v1.5.1**（2025-12-24）：模型參數移到 config
- **v1.5.0**（2025-12-24）：LLM 模型更新
- **v1.4.0**（2025-12-24）：VAD/ASR 系統全面修復
- **v1.3.0**（2025-12-23）：iPhone 風格 UI 改進
- **v1.2.0**（2025-12-23）：反向顯示開關
- **v1.1.0**（2025-12-23）：Bug 修復與文件建立
- **v1.0.0**（2025-01-25）：初始版本
