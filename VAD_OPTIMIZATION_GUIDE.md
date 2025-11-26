# VAD 噪音過濾優化指南

## 問題描述

在開車等嘈雜環境中使用時，遇到以下問題：
1. **背景噪音干擾**：引擎聲、路噪等背景聲音被誤判為語音
2. **即時字幕出現 AAAAA**：VAD 誤判短促噪音為語音，導致 Whisper 識別出無意義字元
3. **翻譯效果不佳**：噪音干擾導致識別準確度下降

## 優化措施

### 1. 提高 RMS 閾值（Voice Activity Detection）

**修改前**：`RMS_THRESHOLD = 0.04`
**修改後**：`RMS_THRESHOLD = 0.08`（提高 100%）

**效果**：
- 過濾低強度的背景噪音（引擎聲、路噪）
- 只有較強的語音信號才會觸發 VAD
- 減少誤判，提高識別準確度

### 2. 延長靜音檢測時間

**修改前**：`SILENCE_DURATION_MS = 800`（0.8 秒）
**修改後**：`SILENCE_DURATION_MS = 1000`（1.0 秒）

**效果**：
- 避免說話中的短暫停頓被誤判為語音結束
- 讓系統有更多時間確認真正的靜音
- 減少片段切割，提高翻譯完整性

### 3. 加入最小語音長度檢測（新功能）

**新增參數**：`MIN_SPEECH_DURATION_MS = 300`（0.3 秒）

**邏輯**：
```typescript
const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current;

if (speechDuration < MIN_SPEECH_DURATION_MS) {
  // 語音時間太短，判定為噪音，直接丟棄
  console.log(`⚠️ Speech too short (${speechDuration}ms), discarding as noise`);
  sentenceBufferRef.current = [];
} else {
  // 有效語音，進行翻譯
  processSentenceForTranslation([...sentenceBufferRef.current]);
}
```

**效果**：
- 過濾短促噪音（例如：車門聲、按鈕聲、短促的引擎噪音）
- 避免將 < 300ms 的噪音送到 Whisper 識別
- 解決即時字幕出現 AAAAA 的問題

### 4. 加入語音持續時間追蹤

**新增 Ref**：`speechStartTimeRef`

**追蹤邏輯**：
- 語音開始時記錄 `speechStartTimeRef.current = now`
- 語音結束時計算 `speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current`
- 根據持續時間判斷是否為有效語音

## 參數調整建議

### 不同環境的建議設定

#### 安靜環境（辦公室、家中）
```typescript
const RMS_THRESHOLD = 0.04;
const SILENCE_DURATION_MS = 800;
const MIN_SPEECH_DURATION_MS = 200;
```

#### 一般環境（診間、病房）
```typescript
const RMS_THRESHOLD = 0.06;
const SILENCE_DURATION_MS = 900;
const MIN_SPEECH_DURATION_MS = 250;
```

#### 嘈雜環境（開車、戶外）
```typescript
const RMS_THRESHOLD = 0.08;  // 目前設定
const SILENCE_DURATION_MS = 1000;  // 目前設定
const MIN_SPEECH_DURATION_MS = 300;  // 目前設定
```

#### 極度嘈雜環境（工地、捷運）
```typescript
const RMS_THRESHOLD = 0.12;
const SILENCE_DURATION_MS = 1200;
const MIN_SPEECH_DURATION_MS = 400;
```

## 測試方法

### 1. 查看 Console 日誌

開啟瀏覽器開發者工具（F12）→ Console，觀察以下日誌：

```
🔵 Speech started
⚠️ Speech too short (250ms), discarding as noise  ← 短促噪音被過濾
🟢 Speech ended (duration: 1500ms, silence: 1000ms), processing translation...
```

### 2. 測試場景

**測試 1：背景噪音過濾**
- 開啟錄音，不說話，觀察是否觸發 VAD
- 預期：背景噪音不應觸發「Speech started」

**測試 2：短促噪音過濾**
- 發出短促聲音（拍手、按鈕）
- 預期：看到「Speech too short」日誌，不進行翻譯

**測試 3：正常語音識別**
- 說一句完整的話（> 300ms）
- 預期：正常識別並翻譯，不出現 AAAAA

### 3. 效能指標

查看時間日誌，關注以下指標：

```
[時間統計] Whisper: XXXms
[時間統計] 翻譯: XXXms
[時間統計] 總耗時: XXXms
```

**優化目標**：
- Whisper < 2000ms
- 翻譯 < 1500ms
- 總耗時 < 4000ms

## 已知限制

1. **RMS 閾值過高的副作用**：
   - 可能無法偵測到音量較小的語音
   - 建議使用者在嘈雜環境中提高音量說話

2. **最小語音長度的限制**：
   - 非常短的單字（例如：「嗯」、「啊」）可能被過濾
   - 建議使用完整句子進行對話

3. **靜音檢測時間的權衡**：
   - 時間過長：翻譯延遲增加
   - 時間過短：句子被切斷

## 進一步優化方向

1. **動態閾值調整**：
   - 根據環境噪音自動調整 RMS 閾值
   - 使用移動平均計算背景噪音基準

2. **頻譜分析**：
   - 使用 FFT 分析頻譜特徵
   - 區分人聲和機械噪音

3. **機器學習 VAD**：
   - 使用預訓練的 VAD 模型（例如：Silero VAD）
   - 更準確的語音/噪音分類

4. **使用者可調參數**：
   - 在設定頁面加入 VAD 靈敏度調整
   - 讓使用者根據環境自行調整

## 相關檔案

- `client/src/pages/Home.tsx`：VAD 邏輯實作
  - `RMS_THRESHOLD`：RMS 閾值
  - `SILENCE_DURATION_MS`：靜音檢測時間
  - `MIN_SPEECH_DURATION_MS`：最小語音長度
  - `checkAudioLevel()`：VAD 檢測函數
  - `startVADMonitoring()`：VAD 監控邏輯
