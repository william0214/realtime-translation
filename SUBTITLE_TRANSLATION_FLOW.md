# 即時字幕與翻譯泡泡流程分析

**分析日期：** 2025-12-25  
**版本：** v1.4.2

---

## 📊 整體架構

### 兩條平行處理路徑

```
┌─────────────────────────────────────────────────────────────┐
│                        VAD 監控循環                           │
│                    (每 50ms 檢查一次)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├──────────────────────────────┐
                              │                              │
                    ┌─────────▼─────────┐        ┌──────────▼─────────┐
                    │  Track 1: Partial │        │  Track 2: Final    │
                    │  (即時字幕)        │        │  (最終翻譯)         │
                    │  每 300ms          │        │  語音結束時         │
                    └───────────────────┘        └────────────────────┘
```

---

## 🔄 Segment State Machine（狀態機）

### 狀態定義

```
┌─────────────────────────────────────────────────────────────┐
│                      Segment 生命週期                         │
└─────────────────────────────────────────────────────────────┘

    [IDLE]
      │
      │ Speech START detected (RMS > startThreshold)
      │ (edge-trigger: isSpeaking && !isSpeakingRef.current)
      ▼
    [ACTIVE] ──────────────────────────────────────────┐
      │                                                 │
      │ Every 300ms: Send Partial ASR                  │
      │ (if speechDuration >= minPartialDurationMs)    │
      │                                                 │
      │ Speech END detected (RMS < endThreshold)       │
      │ (edge-trigger: !isSpeaking && isSpeakingRef.current)
      │                                                 │
      ├─────────────────┬───────────────────────────────┤
      │                 │                               │
      ▼                 ▼                               ▼
  [CANCELLED]      [COMPLETED]                    [AUTO-CUT]
  (too short)      (normal end)                   (too long)
      │                 │                               │
      │                 │                               │
      └─────────────────┴───────────────────────────────┘
                        │
                        ▼
                     [IDLE]
```

### 狀態轉換規則

#### 1. **IDLE → ACTIVE**
```typescript
// 觸發條件：Speech START (edge-trigger)
if (isSpeaking && !isSpeakingRef.current) {
  // 建立新 segment
  currentSegmentIdRef.current++;
  activeSegmentsRef.current.add(currentSegmentIdRef.current);
  
  // 建立初始 Partial 訊息
  const initialPartialMessage = { ... };
  setConversations((prev) => [...prev, initialPartialMessage]);
  
  // 更新狀態
  isSpeakingRef.current = true;
  speechStartTimeRef.current = Date.now();
  sentenceEndTriggeredRef.current = false; // 重置 END flag
}
```

#### 2. **ACTIVE → CANCELLED**
```typescript
// 觸發條件：Speech END + speechDuration < 800ms
if (!isSpeaking && isSpeakingRef.current) {
  const speechDuration = Date.now() - speechStartTimeRef.current;
  
  if (speechDuration < 800) {
    // 取消 segment
    activeSegmentsRef.current.delete(currentSegmentId);
    cancelledSegmentsRef.current.add(currentSegmentId);
    
    // 🚫 Abort 所有 pending 請求
    partialAbortController?.abort();
    finalAbortController?.abort();
    
    // 移除 Partial 訊息
    setConversations((prev) => prev.filter((msg) => msg.id !== partialMessageId));
    
    // 更新狀態
    isSpeakingRef.current = false;
    sentenceEndTriggeredRef.current = true; // 設定 END flag
  }
}
```

#### 3. **ACTIVE → COMPLETED**
```typescript
// 觸發條件：Speech END + speechDuration >= 800ms
if (!isSpeaking && isSpeakingRef.current) {
  const speechDuration = Date.now() - speechStartTimeRef.current;
  
  if (speechDuration >= 800) {
    // 🚫 立即 Abort 所有 Partial 請求
    partialAbortController?.abort();
    
    // 處理 Final 翻譯（含 hard-trim）
    const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
    processFinalTranscript(finalBuffers, currentSegmentId);
    
    // 更新狀態
    isSpeakingRef.current = false;
    sentenceEndTriggeredRef.current = true; // 設定 END flag (禁止新 Partial)
  }
}
```

#### 4. **ACTIVE → AUTO-CUT**
```typescript
// 觸發條件：speechDuration > 4000ms (自動切段)
if (isSpeakingRef.current) {
  const speechDuration = Date.now() - speechStartTimeRef.current;
  
  if (speechDuration > 4000) {
    // 🚫 立即 Abort 所有 Partial 請求
    partialAbortController?.abort();
    
    // 處理 Final 翻譯（含 hard-trim）
    const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
    processFinalTranscript(finalBuffers, currentSegmentId);
    
    // 重置狀態（準備下一個 segment）
    sentenceBufferRef.current = [];
    partialBufferRef.current = [];
    speechStartTimeRef.current = Date.now();
    sentenceEndTriggeredRef.current = false; // 重置 END flag (允許新 Partial)
  }
}
```

### 關鍵規則

#### ✅ **END Edge-Trigger（邊緣觸發）**
```typescript
// ❌ 錯誤：Level-trigger（電平觸發）
if (!isSpeaking) {
  // 這會在靜音期間持續觸發
}

// ✅ 正確：Edge-trigger（邊緣觸發）
if (!isSpeaking && isSpeakingRef.current) {
  // 只在 speaking → not speaking 的瞬間觸發一次
  sentenceEndTriggeredRef.current = true; // 立即設定 flag
}
```

#### 🚫 **END 後禁止 Partial**
```typescript
// 在 VAD 監控循環中
if (partialDuration >= 300 && 
    isSpeakingRef.current && 
    !sentenceEndTriggeredRef.current) { // 👈 檢查 END flag
  // 發送 Partial ASR
  processPartialChunk(...);
}

// 在 processPartialChunk 中
if (cancelledSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ Segment #${segmentId} cancelled, ignoring Partial`);
  return; // 👈 已取消的 segment 不處理
}

if (!activeSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ Segment #${segmentId} not active, ignoring Partial`);
  return; // 👈 非活躍的 segment 不處理
}
```

---

## 🎯 Track 1: Partial 即時字幕流程

### 觸發條件（修正版）
```typescript
// 在 VAD 監控循環中 (Home.tsx:862-893)
const partialDuration = Date.now() - lastPartialTimeRef.current;
const speechDuration = Date.now() - speechStartTimeRef.current;

// ✅ 使用 minPartialDurationMs 作為主要門檻
if (partialDuration >= PARTIAL_CHUNK_INTERVAL_MS && 
    isSpeakingRef.current && 
    !sentenceEndTriggeredRef.current &&
    speechDuration >= minPartialDurationMs) { // 👈 主要門檻
  
  // ✅ Buffer count 僅做 sanity check
  if (partialBufferRef.current.length >= PARTIAL_CHUNK_MIN_BUFFERS) {
    // 使用滑動窗口 (最後 1.5 秒)
    const windowBuffers = partialBufferRef.current.slice(-BUFFERS_PER_WINDOW);
    processPartialChunk(windowBuffers, currentSegmentId);
  } else {
    console.warn(`⚠️ Partial buffer too short (${partialBufferRef.current.length} < ${PARTIAL_CHUNK_MIN_BUFFERS}), skipping`);
  }
  
  lastPartialTimeRef.current = Date.now();
}
```

### 門檻參數說明

#### ✅ **主要門檻：minPartialDurationMs**
```typescript
const minPartialDurationMs = 300; // 語音持續時間 >= 300ms 才發送 Partial
```
- **用途**：確保語音片段足夠長，避免處理短促噪音
- **優先級**：**高**（主要判斷條件）

#### ✅ **Sanity Check：PARTIAL_CHUNK_MIN_BUFFERS**
```typescript
const PARTIAL_CHUNK_MIN_BUFFERS = 10; // ~200ms at 48kHz
```
- **用途**：防止極端情況（buffer 異常少）
- **優先級**：**低**（僅做健全性檢查）

### 處理流程

#### 1. 前端處理 (`processPartialChunk`)
```
開始
  │
  ├─ Segment 檢查 (是否已取消/不活躍)
  │   └─ ❌ 如果已取消 → 忽略請求
  │
  ├─ 語音狀態檢查 (isSpeakingRef.current)
  │   └─ ❌ 如果不在說話 → 跳過 ASR
  │
  ├─ 建立 AbortController (用於取消請求)
  │
  ├─ PCM → AudioBuffer → WebM (Opus 48kbps)
  │
  ├─ 檢查 WebM 大小 (< 1KB 跳過)
  │
  ├─ Base64 編碼
  │
  └─ 呼叫後端 API
       │
       └─ transcriptOnly: true (只做 ASR，不翻譯)
```

#### 2. 後端處理 (`autoTranslate` with `transcriptOnly: true`)
```
收到音訊
  │
  ├─ Whisper ASR (語音轉文字)
  │   └─ 模型: gpt-4o-mini-transcribe (預設)
  │   └─ 時間: ~500-1000ms
  │
  └─ 回傳結果
       └─ { success: true, sourceText: "...", translatedText: "" }
```

#### 3. 前端更新 UI
```
收到 ASR 結果
  │
  ├─ Segment 檢查 (async 回應時再次檢查)
  │   └─ ❌ 如果已取消 → 忽略回應
  │
  ├─ 幻覺檢測 (detectWhisperHallucination)
  │   └─ ❌ 如果是幻覺 → 跳過
  │
  ├─ 更新 Partial 訊息 (黃框字幕)
  │   └─ 找到 segmentToPartialMessageRef.get(segmentId)
  │   └─ 更新 conversations 中的對應訊息
  │   └─ originalText = result.sourceText
  │   └─ status = "partial"
  │
  └─ 更新 currentSubtitle (顯示在畫面上方)
```

---

## 🎯 Track 2: Final 最終翻譯流程

### maxFinalSec 統一規範

#### ✅ **所有 Final Path 必須 Hard-Trim**
```typescript
const MAX_FINAL_SEC = 2.0; // 最大 Final chunk 長度（秒）
const MAX_FINAL_BUFFERS = Math.floor((MAX_FINAL_SEC * SAMPLE_RATE) / 960); // ~100 buffers
```

#### ✅ **三種 Final Path 統一處理**

##### 1. **Speech END (正常結束)**
```typescript
// Home.tsx: 語音結束時
if (!isSpeaking && isSpeakingRef.current && speechDuration >= 800) {
  // 🔥 Hard-trim to maxFinalSec
  const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
  processFinalTranscript(finalBuffers, currentSegmentId);
}
```

##### 2. **Auto-Cut (自動切段)**
```typescript
// Home.tsx: 語音超過 4 秒自動切段
if (isSpeakingRef.current && speechDuration > 4000) {
  // 🔥 Hard-trim to maxFinalSec
  const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
  processFinalTranscript(finalBuffers, currentSegmentId);
}
```

##### 3. **Stop Recording (手動停止)**
```typescript
// Home.tsx: 使用者點擊「結束對話」
const stopRecording = useCallback(() => {
  if (isSpeakingRef.current && sentenceBufferRef.current.length > 0) {
    // 🔥 Hard-trim to maxFinalSec
    const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
    processFinalTranscript(finalBuffers, currentSegmentIdRef.current);
  }
  // ...
}, []);
```

### 觸發條件
```typescript
// 在 VAD 監控循環中 (Home.tsx:994-1108)
if (!isSpeaking && isSpeakingRef.current) {
  // 語音結束
  const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current;
  
  if (speechDuration >= 800ms) {
    // 有效語音
    sentenceEndTriggeredRef.current = true; // 立即設定 flag
    isSpeakingRef.current = false;
    
    // 🚫 立即取消所有 Partial 請求
    const partialAbortController = partialAbortControllersRef.current.get(currentSegmentId);
    if (partialAbortController) {
      partialAbortController.abort();
    }
    
    // 🔥 Hard-trim to maxFinalSec
    const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
    
    // 處理 Final 翻譯
    processFinalTranscript(finalBuffers, currentSegmentId);
  }
}
```

### 處理流程

#### 1. 前端處理 (`processFinalTranscript`)
```
開始
  │
  ├─ Segment 檢查 (是否已取消/不活躍)
  │   └─ ❌ 如果已取消 → 忽略請求
  │
  ├─ Buffer 長度檢查 (< 12 buffers 跳過)
  │
  ├─ 🔥 Hard-trim to maxFinalSec (強制限制長度)
  │   └─ finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS)
  │
  ├─ 建立 AbortController (用於取消請求)
  │
  ├─ PCM → AudioBuffer → WebM (Opus 48kbps)
  │
  ├─ 檢查 WebM 大小 (< 1KB 跳過)
  │
  ├─ Base64 編碼
  │
  └─ 呼叫後端 API
       │
       └─ transcriptOnly: false (做 ASR + 翻譯)
```

#### 2. 後端處理 (`autoTranslate` with `transcriptOnly: false`)
```
收到音訊
  │
  ├─ Whisper ASR (語音轉文字)
  │   └─ 模型: gpt-4o-mini-transcribe (預設)
  │   └─ 時間: ~500-1500ms
  │
  ├─ 語言偵測 / 方向判斷
  │   └─ determineDirection(detectedLanguage, targetLang)
  │   └─ 判斷: nurse_to_patient 或 patient_to_nurse
  │
  ├─ LLM 翻譯
  │   └─ 模型: gpt-4.1-mini (預設)
  │   └─ 時間: ~400-600ms
  │
  └─ 回傳結果
       └─ { success: true, sourceText: "...", translatedText: "...", direction: "..." }
```

#### 3. 前端更新 UI
```
收到翻譯結果
  │
  ├─ 幻覺檢測 (detectWhisperHallucination)
  │   └─ ❌ 如果是幻覺 → 移除 Partial 訊息，跳過
  │
  ├─ 判斷說話者
  │   └─ sourceSpeaker = direction === "nurse_to_patient" ? "nurse" : "patient"
  │   └─ targetSpeaker = direction === "nurse_to_patient" ? "patient" : "nurse"
  │
  ├─ Step 1: 更新 Partial 為 Final (覆蓋黃框 → 藍框)
  │   └─ 如果 partialMessageIdRef.current !== null
  │       └─ 更新 conversations 中的對應訊息
  │       └─ originalText = result.sourceText
  │       └─ status = "final"
  │       └─ partialMessageIdRef.current = null (重置)
  │   └─ 否則
  │       └─ 建立新的 Final 訊息 (藍框)
  │
  ├─ Step 2: 新增翻譯訊息 (綠框)
  │   └─ 建立新的 Translated 訊息
  │   └─ speaker = sourceSpeaker (🔥 兩者都在說話者這邊)
  │   └─ originalText = result.sourceText
  │   └─ translatedText = result.translatedText
  │   └─ status = "translated"
  │
  ├─ 儲存到資料庫 (saveTranslationMutation)
  │
  └─ 清空 currentSubtitle
```

---

## ⏱️ 時間統計

### Partial 字幕 (即時字幕)
```
觸發頻率: 每 300ms
處理時間:
  - PCM → WebM 轉換: ~50-100ms
  - 網路傳輸: ~50-100ms
  - Whisper ASR: ~500-1000ms
  - UI 更新: ~10-20ms
總延遲: ~600-1200ms
```

### Final 翻譯 (最終翻譯)
```
觸發時機: 語音結束時 (靜音 > 650ms)
處理時間:
  - PCM → WebM 轉換: ~50-100ms
  - 網路傳輸: ~50-100ms
  - Whisper ASR: ~500-1500ms
  - LLM 翻譯: ~400-600ms
  - UI 更新: ~10-20ms
總延遲: ~1000-2300ms (1-2.3 秒)
```

---

## 🚀 延遲優化策略

### ✅ **可透過以下技術降低體感延遲**

#### 1. **Hard-Trim（強制截斷）**
```typescript
// 🔥 所有 Final path 統一 hard-trim to 2.0s
const MAX_FINAL_BUFFERS = Math.floor((2.0 * SAMPLE_RATE) / 960);
const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
```
- **效果**：防止超長音訊（12-14 秒）導致 Whisper 幻覺
- **延遲改善**：Whisper 處理時間從 2-4 秒降到 0.5-1.5 秒
- **狀態**：✅ 已實作

#### 2. **二段式翻譯（Partial + Final）**
```typescript
// Track 1: Partial (只做 ASR，不翻譯)
transcriptOnly: true  // ~600-1200ms

// Track 2: Final (ASR + 翻譯)
transcriptOnly: false // ~1000-2300ms
```
- **效果**：使用者在 600-1200ms 就能看到即時字幕
- **體感延遲**：從 2-3 秒降到 0.6-1.2 秒
- **狀態**：✅ 已實作

#### 3. **減少 Base64 編碼開銷**
```typescript
// ❌ 舊方法：Buffer → Base64 → 傳輸 → Base64 decode
const base64Audio = Buffer.from(webmBlob).toString("base64");

// ✅ 優化方法：直接傳輸 Binary (需後端支援)
// 可節省 ~33% 傳輸大小和編碼時間
```
- **效果**：減少編碼/解碼時間（~20-50ms）
- **延遲改善**：~50-100ms
- **狀態**：❌ 未實作（需後端支援）

#### 4. **Partial 節流（Throttling）**
```typescript
// ✅ 已實作：每 300ms 發送一次 Partial
const PARTIAL_CHUNK_INTERVAL_MS = 300;

// 🔮 可調整：降低頻率以減少 API 呼叫
const PARTIAL_CHUNK_INTERVAL_MS = 500; // 改為 500ms
```
- **效果**：減少 API 呼叫次數，降低後端負載
- **權衡**：即時字幕更新頻率降低
- **狀態**：✅ 已實作（300ms），可調整

#### 5. **Streaming ASR（串流識別）**
```typescript
// 🔮 未來方向：使用 Streaming Whisper API
// 可在語音進行中逐步返回識別結果
```
- **效果**：進一步降低體感延遲（< 500ms）
- **狀態**：❌ 未實作（需 API 支援）

#### 6. **並行處理（Parallel Processing）**
```typescript
// ✅ 已實作：Partial 和 Final 並行處理
// Partial 不會阻塞 Final，Final 不會阻塞 Partial
```
- **效果**：兩條路徑互不干擾
- **狀態**：✅ 已實作

### 📊 優化效果總結

| 優化技術 | 延遲改善 | 實作狀態 |
|---------|---------|---------||
| Hard-Trim | -1000~-2000ms | ✅ 已實作 |
| 二段式翻譯 | -1000~-1500ms (體感) | ✅ 已實作 |
| 減少 Base64 | -50~-100ms | ❌ 未實作 |
| Partial 節流 | 降低後端負載 | ✅ 已實作 |
| Streaming ASR | -500~-1000ms | ❌ 未實作 |
| 並行處理 | 避免阻塞 | ✅ 已實作 |

**總體改善：** 體感延遲從 3-4 秒降到 1-2 秒（降低 50%）

---

## 🎯 驗收指標

### 1. **Partial 重複更新次數**
```
目標：語音結束後，Partial 字幕不再更新
測試方法：
  1. 說一句話（1-2 秒）
  2. 停止說話
  3. 觀察 Console 日誌
  4. 檢查是否有 "🚫 [Segment#X] Aborted pending Partial requests"
  5. 確認沒有 "[Partial] Updated partial message" 出現在語音結束後

驗收標準：
  ✅ 語音結束後 0 次 Partial 更新
  ❌ 語音結束後 > 0 次 Partial 更新
```

### 2. **Final chunk 長度**
```
目標：所有 Final chunk ≤ 2.0 秒
測試方法：
  1. 說不同長度的句子（1-5 秒）
  2. 觀察 Console 日誌
  3. 檢查 "🟢 Speech ended (..., final chunk: X.XXs)"
  4. 確認 final chunk 長度 ≤ 2.0s

驗收標準：
  ✅ 所有 final chunk ≤ 2.0s
  ❌ 任何 final chunk > 2.0s
```

### 3. **Segment END edge-trigger**
```
目標：語音結束只觸發一次 Final 處理
測試方法：
  1. 說一句話（1-2 秒）
  2. 停止說話
  3. 觀察 Console 日誌
  4. 檢查 "🟢 Speech ended" 出現次數
  5. 檢查 "[Translation] Processing sentence" 出現次數

驗收標準：
  ✅ 每次語音結束只出現 1 次 "🟢 Speech ended"
  ✅ 每次語音結束只出現 1 次 "[Translation] Processing sentence"
  ❌ 出現多次（表示 level-trigger 而非 edge-trigger）
```

### 4. **END 後禁止 Partial**
```
目標：語音結束後不再發送 Partial ASR 請求
測試方法：
  1. 說一句話（1-2 秒）
  2. 停止說話
  3. 觀察 Console 日誌
  4. 檢查語音結束後是否有 "[Partial] Processing chunk"
  5. 檢查是否有 "⚠️ Segment #X cancelled/not active, ignoring Partial"

驗收標準：
  ✅ 語音結束後沒有新的 "[Partial] Processing chunk"
  ✅ 如果有 async 回應返回，應該被忽略（"⚠️ Segment #X cancelled"）
  ❌ 語音結束後仍有新的 Partial 請求發送
```

### 5. **所有 Final path 一致 hard-trim**
```
目標：Speech END / Auto-Cut / Stop Recording 三種路徑都 hard-trim to 2.0s
測試方法：
  1. 測試 Speech END：說 1-2 秒句子，停止說話
  2. 測試 Auto-Cut：連續說話超過 4 秒
  3. 測試 Stop Recording：說話中點擊「結束對話」
  4. 觀察 Console 日誌
  5. 檢查所有 "[Translation] Processing sentence" 的 duration

驗收標準：
  ✅ Speech END: final chunk ≤ 2.0s
  ✅ Auto-Cut: final chunk ≤ 2.0s
  ✅ Stop Recording: final chunk ≤ 2.0s
  ❌ 任何路徑的 final chunk > 2.0s
```

---

## 🐛 已知問題

### 問題 1: Partial 字幕重複更新 ✅ 已修復
**現象：** 語音結束後，Partial 字幕仍更新 2-3 次

**原因：** 已發出的 Partial ASR 請求還在處理中，回應返回時更新 UI

**修復：** 語音結束時立即取消所有 Partial AbortControllers

**驗收：** 使用驗收指標 #1 和 #4 測試

### 問題 2: Final 翻譯延遲 (3-4 秒) ✅ 已優化
**現象：** 語音結束後 3-4 秒才顯示翻譯

**原因：**
- Whisper ASR: ~1-2 秒
- LLM 翻譯: ~1-2 秒
- 總計: ~2-4 秒

**優化：**
- ✅ Hard-Trim：防止超長音訊
- ✅ 二段式翻譯：Partial 提供即時反饋
- ✅ 並行處理：避免阻塞

**效果：** 體感延遲從 3-4 秒降到 1-2 秒

**驗收：** 使用驗收指標 #2 測試

---

## 🔄 Segment 生命週期管理

### Segment 建立
```typescript
// 語音開始時 (Home.tsx:914-939)
if (isSpeaking && !isSpeakingRef.current) {
  // 建立新 segment
  currentSegmentIdRef.current++;
  const newSegmentId = currentSegmentIdRef.current;
  activeSegmentsRef.current.add(newSegmentId);
  
  // 建立初始 Partial 訊息 (黃框)
  const initialPartialMessage: ConversationMessage = {
    id: messageIdRef.current++,
    speaker: dualMicMode ? currentSpeaker : "nurse",
    originalText: "",
    translatedText: "",
    detectedLanguage: "unknown",
    timestamp: new Date(),
    status: "partial",
  };
  setConversations((prev) => [...prev, initialPartialMessage]);
  
  // 記錄 segment → partial message 的映射
  segmentToPartialMessageRef.current.set(newSegmentId, initialPartialMessage.id);
  partialMessageIdRef.current = initialPartialMessage.id;
}
```

### Segment 取消 (短音)
```typescript
// 語音太短時 (Home.tsx:1005-1041)
if (speechDuration < 800ms) {
  // 取消 segment
  activeSegmentsRef.current.delete(currentSegmentId);
  cancelledSegmentsRef.current.add(currentSegmentId);
  
  // 取消所有 pending 請求
  partialAbortController.abort();
  finalAbortController.abort();
  
  // 移除 Partial 訊息
  setConversations((prev) => prev.filter((msg) => msg.id !== partialMessageId));
  
  // 清理
  segmentToPartialMessageRef.current.delete(currentSegmentId);
  partialMessageIdRef.current = null;
}
```

### Segment 完成 (正常結束)
```typescript
// 語音正常結束時 (Home.tsx:1042-1108)
if (speechDuration >= 800ms) {
  sentenceEndTriggeredRef.current = true;
  isSpeakingRef.current = false;
  
  // 🚫 立即取消所有 Partial 請求
  partialAbortController.abort();
  
    // 🔥 Hard-trim to maxFinalSec
    const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);
    
    // 處理 Final 翻譯
    processFinalTranscript(finalBuffers, currentSegmentId);
  
  // 清空 buffers
  sentenceBufferRef.current = [];
  partialBufferRef.current = [];
}
```



---

## 🎯 最佳實踐

### 1. Segment 檢查
所有 async 回應都應該檢查 segment 狀態：
```typescript
// 在 async 回應中
if (cancelledSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ Segment #${segmentId} cancelled, ignoring response`);
  return;
}

if (!activeSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ Segment #${segmentId} not active, ignoring response`);
  return;
}
```

### 2. AbortController 管理
每個請求都應該建立 AbortController：
```typescript
// Partial 請求
const abortController = new AbortController();
partialAbortControllersRef.current.set(segmentId, abortController);

// 語音結束時取消
const partialAbortController = partialAbortControllersRef.current.get(segmentId);
if (partialAbortController) {
  partialAbortController.abort();
  partialAbortControllersRef.current.delete(segmentId);
}
```

### 3. 狀態同步
確保所有狀態更新的順序正確：
```typescript
// 語音結束時的正確順序
sentenceEndTriggeredRef.current = true;  // 1. 立即設定 flag
isSpeakingRef.current = false;           // 2. 更新說話狀態
partialAbortController.abort();          // 3. 取消 Partial 請求
processFinalTranscript(...);             // 4. 處理 Final 翻譯
```

### 4. Hard-Trim 一致性
所有 Final path 都必須 hard-trim：
```typescript
// ✅ 正確：統一使用 MAX_FINAL_BUFFERS
const finalBuffers = sentenceBufferRef.current.slice(-MAX_FINAL_BUFFERS);

// ❌ 錯誤：直接使用整個 buffer
const finalBuffers = sentenceBufferRef.current; // 可能超過 2.0s
```

---

## 📝 日誌追蹤

### Partial 流程日誌
```
[Partial/Segment#1] Using sliding window: 11 buffers (~1.5s) from partialBuffer
[Partial/Segment#1] Processing chunk with 11 PCM buffers
[Subtitle] Created WebM blob, size: 6448 bytes
[Frontend/Subtitle] 🎤 ASR Model: gpt-4o-mini-transcribe (mode: normal)
[Partial/Segment#1] Updated partial message #0: "你好，我是護理師。"
```

### Final 流程日誌
```
[VAD] 🔇 Speech END detected: RMS=0.0058 < endThreshold=0.0450
🚫 [Segment#1] Aborted pending Partial requests (speech ended)
🟢 Speech ended (duration: 2500ms, silence: 650ms, final chunk: 2.00s)
[Translation] Processing sentence with 100 PCM buffers (duration: 2.00s)
[Translation] Created WebM blob, size: 19973 bytes
[Frontend] 🎤 ASR Model: gpt-4o-mini-transcribe (mode: normal)
[Frontend] 🌐 Translation Model: gpt-4.1-mini
[Translation] Backend response: {success: true, sourceText: '...', translatedText: '...'}
[Final] Updated partial #0 to final: "你好，我是護理師。"
[Translated] Added translated message #1 (speaker: nurse)
```

---

## 🔧 待優化項目

### 優先級 1: 已完成
- [x] 語音結束時取消 Partial 請求
- [x] 所有 Final path 統一 hard-trim
- [x] Segment State Machine 實作
- [x] END edge-trigger 實作
- [x] END 後禁止 Partial

### 優先級 2: 可選優化
- [ ] 減少 Base64 編碼（需後端支援）
- [ ] 調整 Partial 節流頻率（可配置）

### 優先級 3: 未來考慮
- [ ] Streaming ASR（需 API 支援）
- [ ] Streaming 翻譯（需 API 支援）
- [ ] 預測性翻譯（在 ASR 完成前開始翻譯）

---

**文件版本：** 1.4.2  
**最後更新：** 2025-12-25
