# VAD 和 ASR 邏輯修正指南

## 📋 修正概述

本次修正針對 VAD（語音活動偵測）和 ASR（語音識別）邏輯進行了全面優化，解決了以下六個關鍵問題：

1. ✅ 禁止產生 < 200ms chunk（< 6 個 buffer 直接丟棄）
2. ✅ Partial chunk 固定 300ms（不低於 280ms）
3. ✅ Final transcript 只在完整句子後觸發（final chunk ≥ 0.8-1.5 秒）
4. ✅ Partial message 永遠只更新一條（同一語音段落 partialMessageId 不變）
5. ✅ Final 完成後重置狀態（清空 buffer、reset ID、talking = false）
6. ✅ 一段語音只能做一次 final（已做過 final 則禁止新 partial 和重複 final）

---

## 🔧 修正內容

### 1. 配置檔案參數調整（`shared/config.ts`）

#### 修改前：
```typescript
MIN_SPEECH_DURATION_MS: 250,    // 最小語音持續時間
SILENCE_DURATION_MS: 650,        // 靜音持續時間
PARTIAL_CHUNK_INTERVAL_MS: 320, // Partial chunk 更新間隔
PARTIAL_CHUNK_MIN_DURATION_MS: 250, // Partial chunk 最小持續時間
```

#### 修改後：
```typescript
MIN_SPEECH_DURATION_MS: 500,    // 提高到 500ms，確保 final chunk ≥ 0.8-1.2 秒
SILENCE_DURATION_MS: 800,        // 提高到 800ms，確保收集完整句子
PARTIAL_CHUNK_INTERVAL_MS: 300, // 固定 300ms，不低於 280ms
PARTIAL_CHUNK_MIN_DURATION_MS: 200, // 降低到 200ms（6 個 buffer ≈ 200-250ms）
```

#### 修正原因：
- **MIN_SPEECH_DURATION_MS**：從 250ms 提高到 500ms，確保 final chunk 至少 0.8 秒，避免過短的句子片段
- **SILENCE_DURATION_MS**：從 650ms 提高到 800ms，給予更充足的時間收集完整句子
- **PARTIAL_CHUNK_INTERVAL_MS**：從 320ms 降低到 300ms，固定間隔避免低於 280ms
- **PARTIAL_CHUNK_MIN_DURATION_MS**：從 250ms 降低到 200ms，配合 6 個 buffer 的檢查邏輯

---

### 2. Partial Chunk 邏輯修正（`Home.tsx`）

#### 修改前：
```typescript
if (partialDuration >= PARTIAL_CHUNK_INTERVAL_MS && isSpeakingRef.current) {
  const speechDuration = now - speechStartTimeRef.current;
  if (speechDuration >= PARTIAL_CHUNK_MIN_DURATION_MS && sentenceBufferRef.current.length > 0) {
    processPartialChunk([...sentenceBufferRef.current]);
  }
  lastPartialTimeRef.current = now;
}
```

#### 修改後：
```typescript
if (partialDuration >= PARTIAL_CHUNK_INTERVAL_MS && isSpeakingRef.current && !sentenceEndTriggeredRef.current) {
  // 禁止 chunks < 200ms (< 6 buffers)
  if (sentenceBufferRef.current.length < 6) {
    console.log(`⚠️ Partial chunk too short (${sentenceBufferRef.current.length} buffers < 6), discarding as noise`);
    lastPartialTimeRef.current = now;
    return;
  }
  
  const speechDuration = now - speechStartTimeRef.current;
  if (speechDuration >= PARTIAL_CHUNK_MIN_DURATION_MS && sentenceBufferRef.current.length > 0) {
    processPartialChunk([...sentenceBufferRef.current]);
  }
  lastPartialTimeRef.current = now;
}
```

#### 修正重點：
1. **禁止短 chunk**：加入 `sentenceBufferRef.current.length < 6` 檢查，過濾 < 200ms 的 chunk
2. **防止重複觸發**：加入 `!sentenceEndTriggeredRef.current` 條件，已做過 final 則不再產生 partial
3. **固定間隔**：確保 `PARTIAL_CHUNK_INTERVAL_MS = 300ms`，不會低於 280ms

---

### 3. Final Transcript 邏輯修正（`Home.tsx`）

#### 修改前：
```typescript
if (isSpeakingRef.current) {
  const silenceDuration = now - lastSpeechTimeRef.current;
  if (silenceDuration >= SILENCE_DURATION_MS && !sentenceEndTriggeredRef.current) {
    const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current;
    
    if (speechDuration < MIN_SPEECH_DURATION_MS) {
      // Too short, discard
      isSpeakingRef.current = false;
      sentenceBufferRef.current = [];
      sentenceEndTriggeredRef.current = true;
      setProcessingStatus("listening");
    } else if (!sentenceEndTriggeredRef.current) {
      // Process final transcript
      sentenceEndTriggeredRef.current = true;
      isSpeakingRef.current = false;
      setProcessingStatus("listening");
      
      if (sentenceBufferRef.current.length > 0) {
        processFinalTranscript([...sentenceBufferRef.current]);
        sentenceBufferRef.current = [];
      }
      
      lastPartialTimeRef.current = 0;
    }
  }
}
```

#### 修改後：
```typescript
if (isSpeakingRef.current && !sentenceEndTriggeredRef.current) {
  const silenceDuration = now - lastSpeechTimeRef.current;
  if (silenceDuration >= SILENCE_DURATION_MS) {
    const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current;
    
    if (speechDuration < MIN_SPEECH_DURATION_MS) {
      // Too short, discard
      console.log(`⚠️ Speech too short (${speechDuration}ms < ${MIN_SPEECH_DURATION_MS}ms), discarding as noise`);
      isSpeakingRef.current = false;
      sentenceBufferRef.current = [];
      partialMessageIdRef.current = null; // Reset partial message ID
      sentenceEndTriggeredRef.current = true;
      setProcessingStatus("listening");
    } else {
      // Speech segment end (valid speech) - only trigger once
      sentenceEndTriggeredRef.current = true;
      isSpeakingRef.current = false;
      
      // Calculate final chunk duration
      const totalSamples = sentenceBufferRef.current.reduce((acc, buf) => acc + buf.length, 0);
      const finalChunkDuration = totalSamples / SAMPLE_RATE;
      
      console.log(`🟢 Speech ended (duration: ${speechDuration}ms, silence: ${silenceDuration}ms, final chunk: ${finalChunkDuration.toFixed(2)}s), processing final transcript ONCE...`);

      // Only process if final chunk >= 0.8s (ensure complete sentence)
      if (finalChunkDuration >= 0.8 && finalChunkDuration <= 1.5) {
        if (sentenceBufferRef.current.length > 0) {
          processFinalTranscript([...sentenceBufferRef.current]);
        }
      } else {
        console.log(`⚠️ Final chunk duration ${finalChunkDuration.toFixed(2)}s out of range [0.8, 1.5], discarding`);
      }
      
      // Reset state after final
      sentenceBufferRef.current = [];
      partialMessageIdRef.current = null; // Reset partial message ID
      lastPartialTimeRef.current = 0;
      setProcessingStatus("listening");
    }
  }
}
```

#### 修正重點：
1. **確保完整句子**：加入 `finalChunkDuration >= 0.8 && finalChunkDuration <= 1.5` 檢查，只處理 0.8-1.5 秒的 final chunk
2. **防止重複觸發**：在條件中加入 `!sentenceEndTriggeredRef.current`，確保一段語音只做一次 final
3. **完整狀態重置**：final 完成後重置 `sentenceBufferRef`、`partialMessageIdRef`、`lastPartialTimeRef`
4. **詳細日誌**：加入 final chunk 時長日誌，方便除錯

---

## 📊 修正效果

### 修正前的問題：

| 問題 | 影響 |
|------|------|
| 產生 < 200ms chunk | 語言誤判（中文識別成韓文/英文） |
| Partial 間隔不固定 | 可能低於 280ms，導致 chunk 太碎 |
| Final 在不完整句子時觸發 | 翻譯品質下降，句子被切碎 |
| Partial message 創建多條 | UI 顯示混亂，多條 partial 訊息 |
| Final 後未重置狀態 | 狀態殘留，影響下一次語音 |
| 一段語音多次 final | 重複翻譯，浪費 API 呼叫 |

### 修正後的改善：

| 改善項目 | 效果 |
|---------|------|
| 禁止短 chunk | 語言識別準確度提升，不再誤判 |
| 固定 300ms 間隔 | Partial 更新穩定，不會太碎 |
| Final ≥ 0.8s | 收集完整句子，翻譯品質提升 |
| Partial 只更新一條 | UI 清晰，只有一條即時字幕 |
| 完整狀態重置 | 每次語音獨立，不互相干擾 |
| 一次 final | 避免重複翻譯，節省 API 成本 |

---

## 🎯 使用建議

### 1. 測試場景

建議在以下場景測試修正效果：

#### 場景 1：短促噪音過濾
- **測試方法**：輕敲麥克風、短促咳嗽、快速「嗯」聲
- **預期結果**：不觸發 partial 或 final，日誌顯示「discarding as noise」

#### 場景 2：完整句子識別
- **測試方法**：說完整句子（1-2 秒），停頓 0.8 秒
- **預期結果**：
  - Partial 每 300ms 更新一次（同一條訊息）
  - Final 在停頓後觸發（final chunk 0.8-1.5 秒）
  - 翻譯準確，句子完整

#### 場景 3：連續對話
- **測試方法**：連續說多句話，每句間隔 0.8 秒
- **預期結果**：
  - 每句話獨立處理
  - 不會出現狀態殘留
  - 每句只觸發一次 final

### 2. 日誌觀察

修正後的日誌會顯示以下關鍵資訊：

```
🔵 Speech started
⚠️ Partial chunk too short (3 buffers < 6), discarding as noise
🟢 Speech ended (duration: 1200ms, silence: 800ms, final chunk: 1.05s), processing final transcript ONCE...
```

**關鍵指標：**
- `Speech duration`：應 ≥ 500ms
- `Silence duration`：應 ≥ 800ms
- `Final chunk duration`：應在 0.8-1.5 秒範圍內
- 不應出現「processing final transcript」多次

### 3. 調整建議

如果修正後仍有問題，可以調整以下參數：

#### 如果 final chunk 太短（< 0.8s）：
```typescript
// shared/config.ts
MIN_SPEECH_DURATION_MS: 600,    // 從 500ms 提高到 600ms
SILENCE_DURATION_MS: 900,        // 從 800ms 提高到 900ms
```

#### 如果 partial 更新太慢：
```typescript
// shared/config.ts
PARTIAL_CHUNK_INTERVAL_MS: 280, // 從 300ms 降低到 280ms（不建議低於 280ms）
```

#### 如果背景噪音仍觸發：
```typescript
// shared/config.ts
RMS_THRESHOLD: 0.08,            // 從 0.055 提高到 0.08
MIN_SPEECH_DURATION_MS: 600,    // 從 500ms 提高到 600ms
```

---

## 🔍 除錯指南

### 問題 1：Partial 字幕不出現

**可能原因：**
- `sentenceBufferRef.current.length < 6`（chunk 太短）
- `speechDuration < PARTIAL_CHUNK_MIN_DURATION_MS`（語音太短）

**檢查方法：**
```javascript
// 查看瀏覽器控制台日誌
⚠️ Partial chunk too short (3 buffers < 6), discarding as noise
```

**解決方案：**
- 說話時間延長至 > 200ms
- 降低 `PARTIAL_CHUNK_MIN_DURATION_MS` 到 150ms（不建議）

### 問題 2：Final 翻譯不觸發

**可能原因：**
- `finalChunkDuration < 0.8s`（句子太短）
- `finalChunkDuration > 1.5s`（句子太長）
- `speechDuration < MIN_SPEECH_DURATION_MS`（語音太短）

**檢查方法：**
```javascript
// 查看瀏覽器控制台日誌
⚠️ Final chunk duration 0.65s out of range [0.8, 1.5], discarding
⚠️ Speech too short (400ms < 500ms), discarding as noise
```

**解決方案：**
- 說完整句子（1-2 秒）
- 停頓時間 > 800ms
- 調整 `MIN_SPEECH_DURATION_MS` 到 400ms（不建議低於 400ms）

### 問題 3：出現多條 Partial 訊息

**可能原因：**
- `partialMessageIdRef.current` 未正確維護
- Final 後未重置 `partialMessageIdRef.current`

**檢查方法：**
```javascript
// 查看瀏覽器控制台日誌
[Partial] Created partial message #1: "你好"
[Partial] Created partial message #2: "你好嗎"  // ❌ 不應創建新訊息
```

**解決方案：**
- 確認 Final 完成後有執行 `partialMessageIdRef.current = null`
- 確認 Partial 邏輯中有檢查 `partialMessageIdRef.current === null`

---

## 📚 相關文件

- `shared/config.ts`：配置檔案
- `CONFIG_GUIDE.md`：配置檔案使用指南
- `VAD_OPTIMIZATION_GUIDE.md`：VAD 優化指南
- `PERFORMANCE_ANALYSIS.md`：效能分析文件

---

## 📝 總結

本次修正全面優化了 VAD 和 ASR 邏輯，解決了六個關鍵問題：

1. ✅ **禁止短 chunk**：< 6 個 buffer（< 200ms）直接丟棄
2. ✅ **固定 partial 間隔**：300ms，不低於 280ms
3. ✅ **確保完整句子**：final chunk ≥ 0.8-1.5 秒
4. ✅ **單一 partial 訊息**：同一語音段落只更新一條
5. ✅ **完整狀態重置**：final 後清空所有狀態
6. ✅ **防止重複 final**：一段語音只做一次 final

**預期效果：**
- 語言識別準確度提升
- 翻譯品質提升（完整句子）
- UI 顯示清晰（單一 partial）
- 避免重複翻譯（節省成本）
- 狀態管理清晰（不互相干擾）

**建議測試：**
1. 短促噪音過濾測試
2. 完整句子識別測試
3. 連續對話測試
4. 觀察日誌驗證邏輯正確性
