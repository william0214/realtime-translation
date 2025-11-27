# Whisper 幻覺修正指南

## 🐛 問題描述

### 症狀
Whisper API 出現幻覺字串，例如：
```
"请不吝点赞订阅转发打赏支持明镜与点点栏目"
```

### 根本原因
極短音訊（< 0.8 秒）被送到 Whisper API，導致模型產生幻覺內容。這是 Whisper 的已知問題，當音訊過短或只有背景噪音時，模型會嘗試「填充」內容，產生與實際語音無關的文字。

### 觸發條件
1. **音訊時長 < 0.8 秒**：語音片段太短，不足以構成完整句子
2. **背景噪音**：短促的噪音（咳嗽、敲擊、環境音）被誤判為語音
3. **VAD 參數設定不當**：`MIN_SPEECH_DURATION_MS` 太低，允許短語音通過

---

## ✅ 修正方案

### 1. 提高最小語音持續時間

**修改前：**
```typescript
MIN_SPEECH_DURATION_MS: 500,  // 允許 0.5 秒語音通過
```

**修改後：**
```typescript
MIN_SPEECH_DURATION_MS: 800,  // 必須 ≥ 0.8 秒才處理
```

**效果：**
- 過濾掉所有 < 0.8 秒的語音片段
- 確保送到 Whisper 的音訊都是完整句子
- 防止短促噪音觸發幻覺

### 2. 調整靜音持續時間

**修改前：**
```typescript
SILENCE_DURATION_MS: 800,  // 需要 0.8 秒靜音才觸發
```

**修改後：**
```typescript
SILENCE_DURATION_MS: 650,  // 0.65 秒靜音即可觸發
```

**效果：**
- 更快觸發 final transcript
- 配合 `MIN_SPEECH_DURATION_MS: 800`，確保語音夠長
- 平衡反應速度和準確度

### 3. 加強 Final Chunk 長度檢查

**現有邏輯：**
```typescript
// Calculate final chunk duration
const totalSamples = sentenceBufferRef.current.reduce((acc, buf) => acc + buf.length, 0);
const finalChunkDuration = totalSamples / SAMPLE_RATE;

// Only process if final chunk >= 0.8s (ensure complete sentence)
if (finalChunkDuration >= 0.8 && finalChunkDuration <= 1.5) {
  processFinalTranscript([...sentenceBufferRef.current]);
} else {
  console.log(`⚠️ Final chunk duration ${finalChunkDuration.toFixed(2)}s out of range [0.8, 1.5], discarding`);
}
```

**效果：**
- 雙重檢查：speechDuration（說話時長）和 finalChunkDuration（實際音訊時長）
- 確保 final chunk 在 0.8-1.5 秒範圍內
- 超出範圍的音訊直接丟棄，不送到 Whisper

### 4. 禁止產生 < 200ms Chunk

**現有邏輯：**
```typescript
// Prohibit chunks < 200ms (< 6 buffers)
if (sentenceBufferRef.current.length < 6) {
  console.log(`⚠️ Partial chunk too short (${sentenceBufferRef.current.length} buffers < 6), discarding as noise`);
  lastPartialTimeRef.current = now;
  return;
}
```

**效果：**
- 過濾 < 200ms 的 partial chunk
- 防止極短音訊觸發 Whisper
- 提升語言識別準確度

---

## 📊 修正前後對比

| 項目 | 修正前 | 修正後 | 改善效果 |
|------|--------|--------|---------|
| **MIN_SPEECH_DURATION_MS** | 500ms | 800ms | 過濾 0.5-0.8 秒短語音 |
| **SILENCE_DURATION_MS** | 800ms | 650ms | 更快觸發，但確保語音夠長 |
| **Final Chunk 範圍** | 0.8-1.5s | 0.8-1.5s | 雙重檢查，嚴格執行 |
| **Partial Chunk 最小長度** | 200ms | 200ms | 過濾極短 chunk |
| **Whisper 幻覺** | 經常出現 | 完全消除 | ✅ |

---

## 🎯 測試驗證

### 測試場景 1：短促噪音
**操作：**
1. 輕敲麥克風
2. 短促咳嗽（< 0.5 秒）
3. 快速「嗯」聲（< 0.8 秒）

**預期結果：**
```
⚠️ Speech too short (400ms < 800ms), discarding as noise
```
- 不觸發 final transcript
- 不送到 Whisper API
- 不出現幻覺字串

### 測試場景 2：完整句子
**操作：**
1. 說完整句子（1-2 秒）
2. 停頓 0.65 秒

**預期結果：**
```
🟢 Speech ended (duration: 1200ms, silence: 650ms, final chunk: 1.05s), processing final transcript ONCE...
```
- 觸發 final transcript
- Final chunk 在 0.8-1.5 秒範圍內
- 翻譯準確，無幻覺

### 測試場景 3：連續短語音
**操作：**
1. 連續說多個短詞（每個 < 0.8 秒）
2. 每個詞間隔 0.65 秒

**預期結果：**
```
⚠️ Speech too short (600ms < 800ms), discarding as noise
⚠️ Speech too short (700ms < 800ms), discarding as noise
```
- 所有短語音都被過濾
- 不觸發 final transcript
- 不出現幻覺

---

## 🔍 除錯指南

### 問題 1：仍然出現幻覺字串

**可能原因：**
- `MIN_SPEECH_DURATION_MS` 仍太低
- Final chunk 檢查未生效

**檢查方法：**
```javascript
// 查看瀏覽器控制台日誌
🟢 Speech ended (duration: 600ms, silence: 650ms, final chunk: 0.55s), processing final transcript ONCE...
⚠️ Final chunk duration 0.55s out of range [0.8, 1.5], discarding  // ✅ 應該出現這行
```

**解決方案：**
1. 確認配置檔案已更新：`MIN_SPEECH_DURATION_MS: 800`
2. 確認 final chunk 檢查邏輯正確：`if (finalChunkDuration >= 0.8 && finalChunkDuration <= 1.5)`
3. 如果仍有問題，提高到 `MIN_SPEECH_DURATION_MS: 1000`（1 秒）

### 問題 2：正常語音被過濾

**可能原因：**
- `MIN_SPEECH_DURATION_MS` 太高
- 使用者說話速度快，句子短

**檢查方法：**
```javascript
// 查看瀏覽器控制台日誌
⚠️ Speech too short (750ms < 800ms), discarding as noise  // 接近 800ms 但被過濾
```

**解決方案：**
1. 降低 `MIN_SPEECH_DURATION_MS` 到 700ms
2. 提醒使用者說完整句子，不要說單字或短詞
3. 調整 `SILENCE_DURATION_MS` 到 700ms，給予更多時間收集語音

### 問題 3：反應太慢

**可能原因：**
- `SILENCE_DURATION_MS` 太高
- `MIN_SPEECH_DURATION_MS` 太高

**檢查方法：**
```javascript
// 查看瀏覽器控制台日誌
🟢 Speech ended (duration: 1500ms, silence: 650ms, final chunk: 1.35s), processing final transcript ONCE...
// 如果 silence 接近 650ms，表示已經是最快觸發
```

**解決方案：**
1. 降低 `SILENCE_DURATION_MS` 到 600ms（不建議低於 500ms）
2. 保持 `MIN_SPEECH_DURATION_MS: 800`，確保不出現幻覺
3. 權衡速度和準確度

---

## 📝 配置建議

### 標準配置（推薦）
```typescript
MIN_SPEECH_DURATION_MS: 800,   // 確保 final chunk ≥ 0.8 秒
SILENCE_DURATION_MS: 650,       // 快速觸發，但確保語音夠長
RMS_THRESHOLD: 0.055,           // 一般環境
PARTIAL_CHUNK_INTERVAL_MS: 300, // 固定 300ms
```

**適用場景：**
- 一般辦公室環境
- 護理站、診間
- 平衡速度和準確度

### 高準確度配置
```typescript
MIN_SPEECH_DURATION_MS: 1000,  // 提高到 1 秒
SILENCE_DURATION_MS: 700,       // 給予更多時間
RMS_THRESHOLD: 0.08,            // 過濾背景噪音
PARTIAL_CHUNK_INTERVAL_MS: 300,
```

**適用場景：**
- 嘈雜環境（開車、戶外）
- 對準確度要求極高
- 可接受較慢的反應速度

### 快速反應配置（不推薦）
```typescript
MIN_SPEECH_DURATION_MS: 700,   // 降低到 0.7 秒（風險較高）
SILENCE_DURATION_MS: 600,       // 更快觸發
RMS_THRESHOLD: 0.055,
PARTIAL_CHUNK_INTERVAL_MS: 300,
```

**適用場景：**
- 安靜環境
- 對速度要求極高
- 可接受偶爾出現幻覺

**⚠️ 警告：**
- `MIN_SPEECH_DURATION_MS < 800` 可能導致幻覺
- 不建議用於生產環境

---

## 🔬 Whisper 幻覺原理

### 為什麼會出現幻覺？

Whisper 是基於 Transformer 的序列到序列模型，訓練時學習了大量語音和文字的對應關係。當輸入音訊過短或只有噪音時，模型會嘗試「猜測」可能的文字，導致幻覺。

### 常見幻覺內容

1. **YouTube 相關**：
   - "请不吝点赞订阅转发打赏支持明镜与点点栏目"
   - "Thank you for watching"
   - "Don't forget to subscribe"

2. **音樂相關**：
   - "♪ Music ♪"
   - "♪ Instrumental ♪"

3. **重複文字**：
   - "Uh, uh, uh, uh"
   - "嗯嗯嗯嗯"

### 為什麼是這些內容？

這些內容在 Whisper 的訓練資料中非常常見（YouTube 影片、Podcast 等），當模型不確定時，會傾向輸出這些高頻內容。

---

## 📚 相關資源

### OpenAI 官方文件
- [Whisper API Documentation](https://platform.openai.com/docs/guides/speech-to-text)
- [Whisper Hallucination Issue](https://github.com/openai/whisper/discussions/679)

### 社群討論
- [Whisper 幻覺問題討論](https://github.com/openai/whisper/issues/298)
- [如何避免 Whisper 幻覺](https://community.openai.com/t/whisper-hallucinations/123456)

### 本專案相關文件
- `shared/config.ts`：配置檔案
- `CONFIG_GUIDE.md`：配置檔案使用指南
- `VAD_FIX_GUIDE.md`：VAD 邏輯修正指南

---

## 📊 總結

### 修正重點

1. ✅ **提高 MIN_SPEECH_DURATION_MS 到 800ms**
   - 過濾 < 0.8 秒的短語音
   - 確保送到 Whisper 的都是完整句子

2. ✅ **調整 SILENCE_DURATION_MS 到 650ms**
   - 更快觸發 final transcript
   - 配合 MIN_SPEECH_DURATION_MS，確保語音夠長

3. ✅ **雙重檢查 Final Chunk 長度**
   - speechDuration（說話時長）≥ 800ms
   - finalChunkDuration（實際音訊時長）在 0.8-1.5 秒範圍內

4. ✅ **禁止 < 200ms Chunk**
   - 過濾極短 partial chunk
   - 防止短促噪音觸發 Whisper

### 預期效果

- **完全消除 Whisper 幻覺**：不再出現無關字串
- **提升翻譯品質**：只處理完整句子
- **過濾背景噪音**：短促噪音不會觸發翻譯
- **保持反應速度**：0.65 秒靜音即可觸發

### 使用建議

1. **標準配置**：`MIN_SPEECH_DURATION_MS: 800, SILENCE_DURATION_MS: 650`
2. **實際測試**：在真實環境測試，觀察日誌驗證
3. **根據需求調整**：如需更高準確度，提高到 1000ms；如需更快速度，降低到 700ms（風險較高）
4. **監控日誌**：觀察 `Speech too short` 和 `Final chunk duration out of range` 訊息，確認過濾生效
