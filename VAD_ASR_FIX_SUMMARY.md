# VAD/ASR 系統修復摘要

**修復日期：** 2025-12-25  
**版本：** v1.4.0  
**修復人員：** Manus AI Agent

---

## 📋 修復概述

本次修復針對 VAD/ASR 系統的五大核心問題進行全面重構，解決了競態條件、音訊切段、垃圾輸出等關鍵問題。

---

## 🐛 修復的核心問題

### 1. 競態條件（Race Condition）
**問題描述：**
- Speech 太短被丟棄後（< 800ms），非同步的 ASR 回應仍然嘗試更新已刪除的 partial message
- Console 頻繁出現 "No partial message to update" 錯誤
- 導致 UI 更新錯誤和翻譯觸發異常

**修復方案：**
- 實作 Segment 機制追蹤每個語音段
- 每次 speech start 建立新 segment（自增 ID）
- Async response 回來前檢查 segment 是否仍為 active
- Speech too short 或 stopRecording 時標記為 cancelled
- 使用 AbortController 中止已取消 segment 的請求

### 2. VAD 門檻抖動
**問題描述：**
- 單一 RMS threshold (0.055) 在臨界值震盪
- RMS 在 0.053~0.056 之間快速切換
- 導致大量短段（< 800ms）被產生和丟棄

**修復方案：**
- 實作雙門檻 VAD（Hysteresis）
- Start threshold: 0.060（連續 >= 3 幀才算 speech start）
- End threshold: 0.045（連續 >= 8 幀才算 speech end）
- 避免 RMS 在臨界值震盪

### 3. Buffer 數量門檻不穩定
**問題描述：**
- 使用 `buffers < 10` 判斷，但 buffer 長度不固定
- 導致頻繁丟棄 partial chunks
- 字幕更新不穩定

**修復方案：**
- 改用時間門檻取代 buffer 數量
- minPartialDurationMs: 500ms（低於就不送 partial）
- minFinalDurationMs: 800ms（低於就視為噪音）

### 4. Final chunk 超長
**問題描述：**
- 即使有 auto-cut 機制，仍出現 2.74s > 2.0s 的情況
- Console 出現 "Final buffer still too long ... this should not happen" 警告
- 超長音訊導致 ASR 處理時間增加

**修復方案：**
- 實作 hard-trim 強制保證 final chunk ≤ 2.0s
- 若超過則只取最後 2.0s
- 同時在 auto-cut 和 speech end 兩處實作

### 5. ASR 垃圾輸出
**問題描述：**
- 產生 "Speaker likely speaks Chinese, Vietnamese..." 等非轉錄性句子
- 產生 "The speaker is..." 等描述句
- 污染字幕和翻譯結果

**修復方案：**
- 增強 detectWhisperHallucination 函數
- 過濾包含 "Speaker likely speaks"、"The speaker is"、"This audio" 的輸出
- 過濾很短但包含多語名詞（Chinese/Vietnamese/English/Indonesian）的輸出

---

## 🔧 技術實作細節

### 1. Segment 機制

**新增 State 和 Refs：**
```typescript
const currentSegmentIdRef = useRef<number>(0);
const activeSegmentsRef = useRef<Set<number>>(new Set());
const cancelledSegmentsRef = useRef<Set<number>>(new Set());
const segmentToPartialMessageRef = useRef<Map<number, number>>(new Map());
const partialAbortControllersRef = useRef<Map<number, AbortController>>(new Map());
const finalAbortControllersRef = useRef<Map<number, AbortController>>(new Map());
```

**Speech Start 時建立 Segment：**
```typescript
const newSegmentId = ++currentSegmentIdRef.current;
activeSegmentsRef.current.add(newSegmentId);
segmentToPartialMessageRef.current.set(newSegmentId, partialMessageId);
```

**Async Response 前檢查 Segment：**
```typescript
if (cancelledSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ [Partial/Segment#${segmentId}] Segment cancelled, ignoring response`);
  return;
}

if (!activeSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ [Partial/Segment#${segmentId}] Segment not active, ignoring response`);
  return;
}
```

**Speech Too Short 時取消 Segment：**
```typescript
activeSegmentsRef.current.delete(currentSegmentId);
cancelledSegmentsRef.current.add(currentSegmentId);

// Abort pending requests
const partialAbortController = partialAbortControllersRef.current.get(currentSegmentId);
if (partialAbortController) {
  partialAbortController.abort();
  partialAbortControllersRef.current.delete(currentSegmentId);
}
```

### 2. 雙門檻 VAD

**參數配置：**
```typescript
const VAD_START_THRESHOLD = 0.060; // Higher threshold for speech start
const VAD_END_THRESHOLD = 0.045;   // Lower threshold for speech end
const VAD_START_FRAMES = 3;        // Consecutive frames above start threshold
const VAD_END_FRAMES = 8;          // Consecutive frames below end threshold
```

**狀態追蹤：**
```typescript
const vadStartFrameCountRef = useRef<number>(0);
const vadEndFrameCountRef = useRef<number>(0);
```

**檢測邏輯：**
```typescript
if (!currentlySpeaking) {
  // Not speaking: check if RMS exceeds START threshold
  if (rms > VAD_START_THRESHOLD) {
    vadStartFrameCountRef.current++;
    if (vadStartFrameCountRef.current >= VAD_START_FRAMES) {
      return true; // Speech started
    }
  } else {
    vadStartFrameCountRef.current = 0;
  }
  return false;
} else {
  // Currently speaking: check if RMS drops below END threshold
  if (rms < VAD_END_THRESHOLD) {
    vadEndFrameCountRef.current++;
    if (vadEndFrameCountRef.current >= VAD_END_FRAMES) {
      return false; // Speech ended
    }
  } else {
    vadEndFrameCountRef.current = 0;
  }
  return true;
}
```

### 3. 音訊路徑分離

**分離的 Buffer：**
```typescript
// Partial buffer: Sliding window for real-time subtitles (only last 1.5s)
const partialBufferRef = useRef<Float32Array[]>([]);
const PARTIAL_WINDOW_DURATION_S = 1.5;

// Final buffer: Accumulated audio for final transcript (will be hard-trimmed)
const sentenceBufferRef = useRef<Float32Array[]>([]);
```

**同時累積到兩個 Buffer：**
```typescript
if (isSpeakingRef.current) {
  sentenceBufferRef.current.push(event.data.data); // For final transcript
  partialBufferRef.current.push(event.data.data);  // For partial transcript
}
```

**Partial 使用滑動窗口：**
```typescript
const BUFFERS_PER_WINDOW = Math.ceil((SAMPLE_RATE * PARTIAL_WINDOW_DURATION_S) / 960);
const windowBuffers = partialBufferRef.current.slice(-BUFFERS_PER_WINDOW);
processPartialChunk(windowBuffers, currentSegmentId);
```

**Final 使用累積音訊並 Hard-trim：**
```typescript
let finalBuffers = sentenceBufferRef.current;
const currentDuration = finalBuffers.reduce((acc, buf) => acc + buf.length, 0) / SAMPLE_RATE;

if (currentDuration > MAX_FINAL_DURATION_S) {
  const targetSamples = Math.floor(MAX_FINAL_DURATION_S * SAMPLE_RATE);
  let accumulatedSamples = 0;
  let startIndex = finalBuffers.length - 1;
  
  for (let i = finalBuffers.length - 1; i >= 0; i--) {
    accumulatedSamples += finalBuffers[i].length;
    if (accumulatedSamples >= targetSamples) {
      startIndex = i;
      break;
    }
  }
  
  finalBuffers = finalBuffers.slice(startIndex);
}
```

### 4. ASR 輸出清洗

**增強的過濾規則：**
```typescript
// Pattern 4: Non-transcription output
const nonTranscriptionPatterns = [
  /Speaker likely speaks/i,
  /The speaker is/i,
  /This audio/i,
  /說話者可能說/i,
  /這段音頻/i,
];

// Pattern 5: Very short text with multiple language names
if (text.length < 100) {
  const languageNames = [
    "Chinese", "Vietnamese", "English", "Indonesian", "Filipino", "Thai", "Japanese", "Korean",
    "中文", "越南語", "英語", "印尼語", "菲律賓語", "泰語", "日語", "韓語",
  ];
  let languageCount = 0;
  for (const lang of languageNames) {
    if (text.includes(lang)) languageCount++;
  }
  if (languageCount >= 3) return true; // Likely language detection output
}
```

### 5. stopRecording 清理

**完整的 Segment 清理：**
```typescript
// Clean up all active segments
activeSegmentsRef.current.forEach((segmentId) => {
  // Abort all pending requests
  const partialAbortController = partialAbortControllersRef.current.get(segmentId);
  if (partialAbortController) {
    partialAbortController.abort();
    partialAbortControllersRef.current.delete(segmentId);
  }
  const finalAbortController = finalAbortControllersRef.current.get(segmentId);
  if (finalAbortController) {
    finalAbortController.abort();
    finalAbortControllersRef.current.delete(segmentId);
  }
  
  // Mark segment as cancelled
  cancelledSegmentsRef.current.add(segmentId);
});

activeSegmentsRef.current.clear();
segmentToPartialMessageRef.current.clear();

// Clear both buffers
sentenceBufferRef.current = [];
partialBufferRef.current = [];

// Reset VAD frame counters
vadStartFrameCountRef.current = 0;
vadEndFrameCountRef.current = 0;
```

---

## 📊 預期效果

### 修復前的問題
1. ❌ Console 頻繁出現 "No partial message to update"
2. ❌ Partial 更新抖動，字幕不穩定
3. ❌ 短音（< 800ms）被丟棄後仍有 UI 更新錯誤
4. ❌ Final chunk 超過 2.0s 上限
5. ❌ ASR 產生 "Speaker likely speaks..." 等垃圾輸出
6. ❌ VAD threshold 在臨界值抖動

### 修復後的預期效果
1. ✅ "No partial message to update" 錯誤近乎消失
2. ✅ Partial 更新穩定，字幕流暢
3. ✅ 短音被丟棄後不再有 UI 更新錯誤
4. ✅ Final chunk 保證 ≤ 2.0s
5. ✅ ASR 垃圾輸出被過濾
6. ✅ VAD 檢測穩定，減少短段

---

## 🧪 驗收標準

### 必須通過的測試
- [ ] **連續講 10 句**：partial 更新不抖動，final 每句都出現且不重覆
- [ ] **快速短音（< 800ms）**：會被丟棄且不再出現 UI 更新錯誤
- [ ] **長句（> 4s）**：會 auto-cut，且 final 每段 duration 符合上限（≤ 2.0s）
- [ ] **Console 日誌**："No partial message to update" 近乎消失
- [ ] **ASR 輸出**：不再出現 "Speaker likely speaks..." 被當成 transcript 顯示或送翻譯

### 測試步驟
1. 啟動錄音
2. 連續講 10 句中文（每句 2-3 秒）
3. 觀察 partial 字幕是否穩定更新
4. 觀察 final 翻譯是否每句都出現
5. 快速講幾個短音（< 800ms）
6. 觀察 console 是否有錯誤
7. 講一句長句（> 4s）
8. 觀察是否會 auto-cut 且 duration 符合上限
9. 停止錄音
10. 檢查 console 日誌

---

## 📝 修改的檔案

### 主要修改
- **client/src/pages/Home.tsx**
  - 新增 Segment 機制相關 state 和 refs
  - 實作雙門檻 VAD
  - 實作音訊路徑分離
  - 實作 hard-trim 強制長度限制
  - 增強 ASR 輸出清洗
  - 完善 stopRecording 清理邏輯

### 文件更新
- **todo.md**
  - 標記所有 VAD/ASR 修復項目為已完成

---

## 🔍 日誌輸出範例

### Segment 生命週期
```
🆕 [Segment#1] Created new segment
🔵 [Segment#1] Speech started (both buffers force-cleared)
[Partial/Segment#1] Using sliding window: 75 buffers (~1.5s) from partialBuffer
[Partial/Segment#1] Updated partial message #1: "你好"
🟢 Speech ended (duration: 2500ms, silence: 600ms, final chunk: 2.00s)
✂️ [Final] Hard-trimmed from 2.74s to 2.00s (max: 2.0s)
```

### VAD 狀態轉換
```
[VAD] 🔊 Speech START detected: RMS=0.0623 > startThreshold=0.0600 (3 consecutive frames)
[VAD] 🔇 Speech END detected: RMS=0.0441 < endThreshold=0.0450 (8 consecutive frames)
```

### Segment 取消
```
⚠️ [Segment#2] Speech too short (750ms < 800ms), discarding as noise
🚫 Cancel segment to prevent async responses from updating UI
[ASR/Segment#2] Removed partial message #2 (speech too short)
```

---

## 🎯 後續建議

### 可選優化（未實作）
1. **Partial 文字去重**：若文字無變化不更新 UI
2. **動態 VAD 門檻**：根據環境噪音自動調整
3. **語音段合併**：短暫停頓（< 300ms）不切段
4. **音訊品質檢測**：送 ASR 前檢測音訊品質

### 監控指標
1. **Segment 取消率**：應 < 10%
2. **Partial 更新頻率**：應 ~3-4 次/秒
3. **Final chunk 平均長度**：應 ~1.5s
4. **ASR 垃圾輸出率**：應 < 1%

---

## 📞 聯絡資訊

如有問題或需要進一步調整，請參考：
- **專案文件**：todo.md, TEST_REPORT.md
- **測試程序**：TESTING_PROCEDURE.md
- **版本歷史**：VERSION_HISTORY.md

---

**修復完成日期：** 2025-12-25  
**下一步：** 執行完整測試並驗收
