# 配置檔案使用指南

## 📋 概述

所有 VAD（語音活動偵測）和 ASR（語音識別）參數已集中到 `shared/config.ts` 配置檔案中，方便統一管理和調整。

## 📁 配置檔案位置

```
shared/config.ts
```

## 🔧 配置項目

### 1. VAD 配置 (`VAD_CONFIG`)

控制語音活動偵測的行為：

```typescript
export const VAD_CONFIG = {
  MIN_SPEECH_DURATION_MS: 250,    // 最小語音持續時間（毫秒）
  SILENCE_DURATION_MS: 650,        // 靜音持續時間（毫秒）
  RMS_THRESHOLD: 0.055,            // RMS 音量閾值（-55dB）
}
```

#### 參數說明

**MIN_SPEECH_DURATION_MS**（最小語音持續時間）
- 短於此時間的語音片段會被視為噪音並過濾掉
- 建議值：
  - 安靜環境：200ms
  - 一般環境：250ms（預設）
  - 嘈雜環境：300ms

**SILENCE_DURATION_MS**（靜音持續時間）
- 偵測到靜音超過此時間後，判定為句子結束
- 建議值：
  - 快速回應：500-600ms
  - 平衡模式：650ms（預設）
  - 完整句子：700-800ms

**RMS_THRESHOLD**（RMS 音量閾值）
- 高於此閾值才被視為有效語音
- 建議值：
  - 安靜環境：0.03-0.04（-60dB）
  - 一般環境：0.055（-55dB，預設）
  - 嘈雜環境：0.08-0.10（-52dB）

### 2. ASR 配置 (`ASR_CONFIG`)

控制語音識別的行為：

```typescript
export const ASR_CONFIG = {
  PARTIAL_CHUNK_INTERVAL_MS: 320,         // Partial chunk 更新間隔
  PARTIAL_CHUNK_MIN_DURATION_MS: 250,     // Partial chunk 最小持續時間
  WHISPER_LANGUAGE_HINT: "...",           // Whisper API 語言提示
  WHISPER_FORCE_LANGUAGE: "zh",           // Whisper API 強制語言
}
```

#### 參數說明

**PARTIAL_CHUNK_INTERVAL_MS**（Partial chunk 更新間隔）
- 即時字幕更新的頻率
- 建議值：
  - 快速更新：250-300ms
  - 平衡模式：320ms（預設）
  - 穩定更新：400-500ms

**PARTIAL_CHUNK_MIN_DURATION_MS**（Partial chunk 最小持續時間）
- 短於此時間的 chunk 會被過濾，避免 chunk 太碎導致語言誤判
- 建議值：
  - 快速回應：200ms
  - 平衡模式：250ms（預設）
  - 穩定識別：300ms

**WHISPER_LANGUAGE_HINT**（Whisper API 語言提示）
- 提升多語言識別準確度
- 預設值：`"Speaker likely speaks Chinese, Vietnamese, English, or Indonesian."`
- 支援語言：Chinese (zh), Vietnamese (vi), English (en), Indonesian (id)

**WHISPER_FORCE_LANGUAGE**（Whisper API 強制語言）
- 設定為 `"zh"` 可提升中文識別準確度
- 設定為 `undefined` 則自動偵測語言
- 建議值：
  - 單人中文模式：`"zh"`（預設）
  - 多語言模式：`undefined`

### 3. 翻譯配置 (`TRANSLATION_CONFIG`)

控制翻譯行為：

```typescript
export const TRANSLATION_CONFIG = {
  DEFAULT_TARGET_LANGUAGE: "Vietnamese",   // 預設目標語言
  SUPPORTED_LANGUAGES: [...],              // 支援的語言列表
}
```

### 4. 音訊配置 (`AUDIO_CONFIG`)

控制音訊錄製和處理：

```typescript
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,                      // 採樣率（Hz）
  AUDIO_FORMAT: "audio/webm;codecs=opus",  // 音訊格式
  MIN_AUDIO_LENGTH_SECONDS: 0.1,           // 最小音訊長度（秒）
}
```

## 🎯 環境預設配置

配置檔案提供了三種環境的預設配置：

### 安靜室內環境（會議室、診間）

```typescript
VAD_PRESETS.QUIET_INDOOR
```

- MIN_SPEECH_DURATION_MS: 200ms
- SILENCE_DURATION_MS: 600ms
- RMS_THRESHOLD: 0.03

### 一般辦公室環境

```typescript
VAD_PRESETS.OFFICE
```

- MIN_SPEECH_DURATION_MS: 250ms
- SILENCE_DURATION_MS: 650ms
- RMS_THRESHOLD: 0.055

### 嘈雜環境（開車、戶外）

```typescript
VAD_PRESETS.NOISY
```

- MIN_SPEECH_DURATION_MS: 300ms
- SILENCE_DURATION_MS: 700ms
- RMS_THRESHOLD: 0.08

## 📝 如何修改配置

### 方法 1：直接修改配置檔案

編輯 `shared/config.ts`，修改對應的參數值：

```typescript
export const VAD_CONFIG = {
  MIN_SPEECH_DURATION_MS: 300,  // 從 250 改為 300
  SILENCE_DURATION_MS: 700,     // 從 650 改為 700
  RMS_THRESHOLD: 0.08,          // 從 0.055 改為 0.08
} as const;
```

### 方法 2：使用環境預設配置

如果想快速切換到特定環境的配置，可以在程式碼中使用預設配置：

```typescript
import { VAD_PRESETS } from "@shared/config";

// 使用嘈雜環境配置
const config = VAD_PRESETS.NOISY;
```

## 🔄 修改後的步驟

1. **編輯配置檔案**：修改 `shared/config.ts` 中的參數值
2. **儲存檔案**：配置會自動重新載入（開發模式下）
3. **重新整理頁面**：前端會使用新的配置
4. **測試效果**：點擊「開始對話」測試新配置

## 📊 配置影響範圍

| 配置項目 | 影響範圍 |
|---------|---------|
| `MIN_SPEECH_DURATION_MS` | 前端 VAD 偵測、噪音過濾 |
| `SILENCE_DURATION_MS` | 前端 VAD 偵測、句子結束判定 |
| `RMS_THRESHOLD` | 前端 VAD 偵測、語音活動判定 |
| `PARTIAL_CHUNK_INTERVAL_MS` | 前端即時字幕更新頻率 |
| `PARTIAL_CHUNK_MIN_DURATION_MS` | 前端 partial chunk 過濾 |
| `WHISPER_LANGUAGE_HINT` | 後端 Whisper API 語言提示 |
| `WHISPER_FORCE_LANGUAGE` | 後端 Whisper API 強制語言 |

## 🎯 調整建議

### 如果翻譯錯誤率高

1. **提高 SILENCE_DURATION_MS**（650ms → 700-800ms）
   - 確保收集完整句子
   - 避免句子被切碎

2. **提高 PARTIAL_CHUNK_MIN_DURATION_MS**（250ms → 300ms）
   - 避免 chunk 太碎
   - 提升語言識別準確度

### 如果反應太慢

1. **降低 SILENCE_DURATION_MS**（650ms → 500-600ms）
   - 更快觸發翻譯
   - 可能會犧牲完整性

2. **降低 PARTIAL_CHUNK_INTERVAL_MS**（320ms → 250-300ms）
   - 更快顯示即時字幕
   - 可能會增加 API 呼叫次數

### 如果背景噪音干擾

1. **提高 RMS_THRESHOLD**（0.055 → 0.08-0.10）
   - 過濾背景噪音
   - 只偵測較大聲的語音

2. **提高 MIN_SPEECH_DURATION_MS**（250ms → 300-400ms）
   - 過濾短促噪音
   - 避免誤判

## 🧪 測試建議

修改配置後，建議進行以下測試：

1. **Partial 字幕測試**
   - 說話時觀察即時字幕更新速度
   - 確認字幕不會太碎或太慢

2. **Final 翻譯測試**
   - 說完整句子後停頓
   - 確認翻譯在合理時間內出現（< 3 秒）

3. **語言識別測試**
   - 測試中文、越南語、英文等語言
   - 確認語言識別準確度

4. **噪音過濾測試**
   - 在有背景噪音的環境測試
   - 確認短促噪音不會觸發翻譯

## 📚 相關文件

- `VAD_OPTIMIZATION_GUIDE.md`：VAD 優化指南
- `PERFORMANCE_ANALYSIS.md`：效能分析文件
- `TESTING_GUIDE.md`：測試指南

## ❓ 常見問題

**Q: 修改配置後需要重啟伺服器嗎？**
A: 開發模式下會自動重新載入，但建議重新整理瀏覽器頁面以確保前端使用新配置。

**Q: 可以針對不同使用者使用不同配置嗎？**
A: 目前配置是全域的，如需針對不同使用者，需要修改程式碼實作動態配置載入。

**Q: 如何恢復預設配置？**
A: 參考 `shared/config.ts` 中的註解，使用建議的預設值即可。
