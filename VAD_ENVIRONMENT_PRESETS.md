# VAD 環境參數預設配置

本文件提供不同使用環境的 VAD（Voice Activity Detection）參數預設值，用於優化語音識別準確度和減少誤判。

---

## 📋 參數說明

### 前端 VAD 參數（client/src/pages/Home.tsx）

```typescript
// RMS 閾值：音量大小閾值，越高越嚴格
const RMS_THRESHOLD = 0.08;

// 靜音檢測時間：持續靜音多久才判定語音結束（毫秒）
const SILENCE_DURATION = 1000;

// 最小語音長度：語音片段最短長度，過濾短促噪音（毫秒）
const MIN_SPEECH_DURATION = 300;
```

### 後端 VAD 參數（backend-go/internal/handler/vad.go）

```go
// RMS 閾值
RMSThreshold: 0.02

// 靜音檢測時間（毫秒）
SilenceDuration: 800

// 最小語音長度（毫秒）
MinSpeechDuration: 200
```

---

## 🏢 環境預設配置

### 1. 安靜室內（會議室、診間）

**特性**：背景噪音極低，語音清晰

**前端參數**：
```typescript
RMS_THRESHOLD = 0.04;        // 較低閾值，捕捉小聲說話
SILENCE_DURATION = 800;      // 較短靜音時間，反應快速
MIN_SPEECH_DURATION = 200;   // 較短最小長度，減少延遲
```

**後端參數**：
```go
RMSThreshold: 0.01
SilenceDuration: 600
MinSpeechDuration: 150
```

**適用場景**：
- 醫生與病患一對一問診
- 小型會議室
- 安靜辦公環境

---

### 2. 辦公室（一般辦公環境）

**特性**：中等背景噪音（鍵盤聲、交談聲）

**前端參數**：
```typescript
RMS_THRESHOLD = 0.06;        // 中等閾值，過濾鍵盤聲
SILENCE_DURATION = 900;      // 中等靜音時間
MIN_SPEECH_DURATION = 250;   // 中等最小長度
```

**後端參數**：
```go
RMSThreshold: 0.015
SilenceDuration: 700
MinSpeechDuration: 200
```

**適用場景**：
- 開放式辦公室
- 護理站
- 多人工作環境

---

### 3. 開車（車內環境）

**特性**：高背景噪音（引擎聲、風聲、路面噪音）

**前端參數**：
```typescript
RMS_THRESHOLD = 0.10;        // 高閾值，過濾引擎噪音
SILENCE_DURATION = 1200;     // 較長靜音時間，避免誤判
MIN_SPEECH_DURATION = 400;   // 較長最小長度，過濾短促噪音
```

**後端參數**：
```go
RMSThreshold: 0.03
SilenceDuration: 1000
MinSpeechDuration: 300
```

**適用場景**：
- 車內通話
- 行動護理車
- 移動環境

---

### 4. 戶外（公共場所）

**特性**：極高背景噪音（人聲、交通、環境音）

**前端參數**：
```typescript
RMS_THRESHOLD = 0.12;        // 極高閾值，嚴格過濾
SILENCE_DURATION = 1500;     // 最長靜音時間
MIN_SPEECH_DURATION = 500;   // 最長最小長度
```

**後端參數**：
```go
RMSThreshold: 0.04
SilenceDuration: 1200
MinSpeechDuration: 400
```

**適用場景**：
- 戶外急救
- 公共場所
- 嘈雜環境

---

## 🔧 動態調整方法

### 前端動態調整

在 `Home.tsx` 中加入環境選擇器：

```typescript
const VAD_PRESETS = {
  indoor: { rms: 0.04, silence: 800, minDuration: 200 },
  office: { rms: 0.06, silence: 900, minDuration: 250 },
  car: { rms: 0.10, silence: 1200, minDuration: 400 },
  outdoor: { rms: 0.12, silence: 1500, minDuration: 500 },
};

const [environment, setEnvironment] = useState<keyof typeof VAD_PRESETS>('office');

// 套用預設值
const preset = VAD_PRESETS[environment];
const RMS_THRESHOLD = preset.rms;
const SILENCE_DURATION = preset.silence;
const MIN_SPEECH_DURATION = preset.minDuration;
```

### 後端動態調整（Hybrid 模式）

使用 WebSocket config 訊息：

```typescript
// 前端發送配置更新
hybridClient.send({
  type: 'config',
  config: {
    vad: {
      rms_threshold: 0.03,
      silence_duration_ms: 1000,
      min_speech_duration_ms: 300,
    },
  },
});
```

---

## 📊 調整建議

### 如何判斷需要調整？

1. **誤判率高（AAAAA 問題）**：
   - 提高 `RMS_THRESHOLD`（例如：0.08 → 0.10）
   - 增加 `MIN_SPEECH_DURATION`（例如：300ms → 400ms）

2. **反應遲鈍（語音結束後等太久）**：
   - 降低 `SILENCE_DURATION`（例如：1000ms → 800ms）

3. **語音被截斷（句子說到一半就結束）**：
   - 增加 `SILENCE_DURATION`（例如：800ms → 1000ms）

4. **小聲說話無法識別**：
   - 降低 `RMS_THRESHOLD`（例如：0.08 → 0.06）

### 調整步驟

1. 先調整前端參數（立即生效）
2. 測試並記錄效果
3. 如需更精細控制，調整後端參數
4. 使用 WebSocket config 訊息動態更新

---

## 🎯 最佳實踐

1. **從預設值開始**：使用「辦公室」預設值作為起點
2. **逐步調整**：每次只調整一個參數，觀察效果
3. **記錄測試結果**：記錄不同環境的最佳參數
4. **提供環境選擇器**：讓使用者根據場景快速切換
5. **監控誤判率**：使用 Console 日誌追蹤「Speech too short」頻率

---

## 📝 實作範例

### 前端加入環境選擇器

```typescript
// 在 Home.tsx 加入環境選擇
<Select value={environment} onValueChange={setEnvironment}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="indoor">安靜室內</SelectItem>
    <SelectItem value="office">辦公室</SelectItem>
    <SelectItem value="car">開車</SelectItem>
    <SelectItem value="outdoor">戶外</SelectItem>
  </SelectContent>
</Select>
```

### 後端動態更新配置

```go
// 在 HybridASRHandler 中處理 config 訊息
case "config":
    if msg.Config != nil && msg.Config.VAD != nil {
        h.vad.UpdateConfig(VADConfig{
            RMSThreshold:       msg.Config.VAD.RMSThreshold,
            SilenceDuration:    msg.Config.VAD.SilenceDurationMs,
            MinSpeechDuration:  msg.Config.VAD.MinSpeechDurationMs,
        })
    }
```

---

## 🔍 故障排除

### 問題：即時字幕出現 AAAAA

**原因**：VAD 誤判背景噪音為語音

**解決方案**：
1. 提高 `RMS_THRESHOLD`（0.08 → 0.10）
2. 增加 `MIN_SPEECH_DURATION`（300ms → 400ms）
3. 檢查麥克風是否過於靈敏

### 問題：語音無法識別

**原因**：VAD 閾值過高，過濾掉真實語音

**解決方案**：
1. 降低 `RMS_THRESHOLD`（0.08 → 0.06）
2. 檢查麥克風音量設定
3. 確認麥克風權限已開啟

### 問題：翻譯延遲太長

**原因**：靜音檢測時間過長

**解決方案**：
1. 降低 `SILENCE_DURATION`（1000ms → 800ms）
2. 使用 Hybrid 模式的 partial transcript 提供即時反饋
3. 優化網路連線速度

---

## 📚 參考資料

- [WebRTC VAD 原理](https://webrtc.org/)
- [Whisper API 文件](https://platform.openai.com/docs/guides/speech-to-text)
- [HYBRID_ASR_GUIDE.md](./backend-go/HYBRID_ASR_GUIDE.md)
- [VAD_OPTIMIZATION_GUIDE.md](./VAD_OPTIMIZATION_GUIDE.md)

---

**最後更新**：2025-01-26
**版本**：1.0.0
