# ASR/VAD 流程重構設計文件

## 目標

完全重構 ASR/VAD 流程，採用固定 20ms buffer、dB 能量檢測、清晰的 partial/final 邏輯，確保翻譯品質和使用者體驗。

## 核心流程

### 1. 音訊輸入（Audio Input）

```
音訊來源 → 固定大小的 PCM buffer（約 20ms）持續輸入
```

- **Buffer 大小**：16000 Hz * 0.02s = 320 samples
- **計算 dB 能量**：每個 buffer 計算 RMS 並轉換為 dB
- **語音判定**：dB > -55dB 視為語音，否則為靜音

### 2. 語音段落開始（Speech Segment Start）

```
連續語音超過 MIN_SPEECH_MS = 400ms → talking = true
```

- **連續語音檢測**：累積連續語音 buffer 的時間
- **段落開始**：當連續語音時間 ≥ 400ms，設定 `talking = true`
- **Buffer 累積**：開始將 buffer 累積到 `pcmBuffers`

### 3. Partial Transcript（即時字幕）

```
條件：talking = true 且累積 buffer 數 ≥ 12（約 240ms）且距離上次 partial ≥ 300ms
動作：切出最近 1 秒的音訊 chunk，呼叫 Whisper，只更新同一條字幕訊息
```

- **觸發條件**：
  1. `talking = true`（正在說話）
  2. 累積 buffer 數 ≥ 12（約 240ms）
  3. 距離上次 partial ≥ 300ms

- **音訊切片**：切出最近 1 秒的音訊 chunk（最多 50 個 buffer）

- **Whisper 呼叫**：
  - 將 1 秒音訊轉換為 WebM 格式
  - 呼叫 Whisper API 做 partial transcript
  - **只更新同一條字幕訊息**，不創建新的訊息

- **限制**：禁止對長度 < 200ms 的 chunk 呼叫 Whisper

### 4. 語音段落結束（Speech Segment End）

```
偵測到靜音時間 ≥ MIN_SILENCE_MS = 600ms → 段落結束
```

- **靜音檢測**：累積連續靜音的時間
- **段落結束判定**：當連續靜音時間 ≥ 600ms，判定段落結束

- **Noise 過濾**：
  - 段落長度 < 800ms → 視為 noise，不呼叫 Whisper
  - 段落長度 ≥ 800ms → 呼叫 Whisper 做 final transcript

- **Final Transcript**：
  - 將整段音訊（所有累積的 buffer）轉換為 WebM 格式
  - 呼叫 Whisper API 做 final transcript
  - **覆蓋原本的 partial 字幕**
  - 呼叫翻譯 API

- **限制**：Final chunk 最大可接受長度 4 秒（不得因超過 1.5 秒而被丟棄）

### 5. 狀態重置（State Reset）

```
Final 完成後，重置段落狀態，禁止對同一段送 final
```

- **重置狀態**：
  - `pcmBuffers = []`（清空累積的 buffer）
  - `currentPartialMessageId = null`（重置 partial message ID）
  - `hasFinalForThisSegment = false`（重置 final 標記）
  - `talking = false`（重置說話狀態）

- **防止重複 final**：
  - 使用 `hasFinalForThisSegment` 標記
  - 一旦 final 完成，禁止對同一段再次送 final

## 狀態變數

### 核心狀態

- `talking: boolean`：是否正在說話
- `pcmBuffers: Float32Array[]`：累積的 PCM buffer
- `currentPartialMessageId: number | null`：當前 partial message 的 ID
- `hasFinalForThisSegment: boolean`：是否已對當前段落送過 final

### 時間追蹤

- `speechStartTime: number`：語音段落開始時間
- `lastSpeechTime: number`：最後一次偵測到語音的時間
- `lastPartialTime: number`：最後一次送 partial 的時間

### 計數器

- `consecutiveSpeechBuffers: number`：連續語音 buffer 數量
- `consecutiveSilenceBuffers: number`：連續靜音 buffer 數量

## 參數配置

### VAD 參數

- `BUFFER_SIZE_MS = 20`：Buffer 大小（毫秒）
- `DB_THRESHOLD = -55`：dB 閾值（> -55dB 視為語音）
- `MIN_SPEECH_MS = 400`：最小語音持續時間（毫秒）
- `MIN_SILENCE_MS = 600`：最小靜音持續時間（毫秒）

### Partial 參數

- `MIN_PARTIAL_BUFFERS = 12`：最小 partial buffer 數量（約 240ms）
- `PARTIAL_INTERVAL_MS = 300`：Partial 更新間隔（毫秒）
- `PARTIAL_CHUNK_DURATION_S = 1.0`：Partial chunk 持續時間（秒）

### Final 參數

- `MIN_FINAL_DURATION_MS = 800`：最小 final 持續時間（毫秒）
- `MAX_FINAL_DURATION_MS = 4000`：最大 final 持續時間（毫秒）
- `MIN_CHUNK_DURATION_MS = 200`：最小 chunk 持續時間（毫秒）

## 流程圖

```
[音訊輸入] → [計算 dB 能量] → [語音/靜音判定]
                                    ↓
                          [連續語音 > 400ms?]
                                    ↓ Yes
                          [talking = true，開始累積 buffer]
                                    ↓
                          [≥12 buffers 且距上次 ≥300ms?]
                                    ↓ Yes
                          [切最近 1 秒，送 Whisper partial]
                                    ↓
                          [更新同一條字幕訊息]
                                    ↓
                          [連續靜音 ≥ 600ms?]
                                    ↓ Yes
                          [段落長度 < 800ms?]
                                    ↓ No
                          [整段送 Whisper final]
                                    ↓
                          [覆蓋 partial，呼叫翻譯]
                                    ↓
                          [重置狀態，talking = false]
```

## 預期效果

1. **Partial 字幕流暢**：每 300ms 更新一次，只更新同一條訊息
2. **Final 翻譯準確**：整段語音送 Whisper，語言識別更準確
3. **Noise 過濾有效**：< 800ms 的短語音被過濾，避免誤觸發
4. **狀態管理清晰**：每個段落獨立，不會互相干擾
5. **防止重複 final**：一個段落只送一次 final，避免重複翻譯

## 實作注意事項

1. **Buffer 大小精確**：確保每個 buffer 固定為 320 samples（20ms）
2. **dB 計算正確**：RMS → dB 轉換公式：`dB = 20 * log10(RMS)`
3. **時間追蹤準確**：使用 `Date.now()` 追蹤時間，確保間隔計算正確
4. **狀態重置完整**：Final 完成後，必須重置所有相關狀態
5. **錯誤處理完善**：Whisper API 呼叫失敗時，不影響後續流程
