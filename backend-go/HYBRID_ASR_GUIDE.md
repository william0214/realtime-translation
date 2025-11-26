# Hybrid ASR 模式完整指南

## 🎯 概述

Hybrid ASR 模式結合了 **streaming（即時字幕）** 和 **segment（完整翻譯）** 兩種方式的優點，提供最佳的使用者體驗：

1. **Partial Transcript（即時字幕）**：快速回傳識別結果，讓使用者立即看到字幕
2. **Final Transcript（完整翻譯）**：VAD 偵測到句子結束後，進行完整的 ASR + Translation + TTS 處理

### 核心特色

- ✅ **並行處理**：使用 Go routines 讓 partial 和 final 不互相阻塞
- ✅ **VAD 句子結束偵測**：自動識別句子結束，觸發完整翻譯
- ✅ **WebSocket 即時通訊**：前端持續傳送音訊 chunk，後端即時回應
- ✅ **三種模式**：segment / stream / hybrid，靈活切換
- ✅ **可插拔 Provider**：自動使用企業級平台的智能路由和 failover

---

## 📁 檔案結構

```
backend-go/
├── internal/
│   └── handler/
│       ├── hybrid_asr.go    # Hybrid ASR Handler 核心邏輯
│       ├── vad.go            # VAD 句子結束偵測器
│       └── websocket.go      # WebSocket 處理器
├── cmd/
│   └── api/
│       └── main_hybrid.go    # 主程式（整合 Hybrid ASR）
└── HYBRID_ASR_GUIDE.md       # 本文件
```

---

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd backend-go
go get github.com/gorilla/websocket
go mod tidy
```

### 2. 設定環境變數

```bash
export OPENAI_API_KEY="your-openai-api-key"
export GOOGLE_API_KEY="your-google-api-key"
export PORT="8080"
```

### 3. 建立客戶方案配置

確保 `configs/client_plans.json` 存在（可從 `client_plans.example.json` 複製）。

### 4. 啟動伺服器

```bash
go run cmd/api/main_hybrid.go
```

輸出範例：

```
Starting Hybrid ASR Server...
Loaded 3 client plans
Providers initialized successfully
Server listening on port 8080
WebSocket endpoint: ws://localhost:8080/ws/hybrid-asr
Health check: http://localhost:8080/health
Status: http://localhost:8080/status
```

---

## 🔌 WebSocket API

### 連線 URL

```
ws://localhost:8080/ws/hybrid-asr?client_id=hospital_a&mode=hybrid
```

**查詢參數**：
- `client_id`：客戶 ID（對應 client_plans.json 中的配置），預設 `default`
- `mode`：ASR 模式，可選值：
  - `segment`：傳統 segment 模式，只在句子結束時回傳
  - `stream`：純 streaming 模式，只回傳 partial transcript
  - `hybrid`：混合模式，同時回傳 partial 和 final（**推薦**）

### 訊息格式

#### 1. 傳送音訊 Chunk（Client → Server）

```json
{
  "type": "audio_chunk",
  "audio_data": "base64_encoded_audio_data",
  "sample_rate": 48000,
  "format": "webm"
}
```

**欄位說明**：
- `type`：訊息類型，固定為 `audio_chunk`
- `audio_data`：Base64 編碼的音訊資料
- `sample_rate`：取樣率（Hz），例如 48000
- `format`：音訊格式，例如 `webm`、`pcm`、`wav`

#### 2. 更新配置（Client → Server）

```json
{
  "type": "config",
  "config": {
    "mode": "hybrid",
    "source_lang": "zh",
    "target_lang": "en",
    "vad_threshold": 0.08,
    "silence_duration": 1000
  }
}
```

**配置欄位**：
- `mode`：ASR 模式（`segment` / `stream` / `hybrid`）
- `source_lang`：來源語言
- `target_lang`：目標語言
- `vad_threshold`：VAD RMS 閾值（0.0 ~ 1.0），預設 0.08
- `silence_duration`：靜音持續時間（毫秒），預設 1000

#### 3. 停止處理（Client → Server）

```json
{
  "type": "stop"
}
```

#### 4. Partial Transcript（Server → Client）

```json
{
  "type": "partial_transcript",
  "transcript": "你好",
  "confidence": 0.95,
  "is_partial": true,
  "timestamp": "2025-01-25T20:30:45Z",
  "latency_ms": 150
}
```

**欄位說明**：
- `type`：訊息類型，固定為 `partial_transcript`
- `transcript`：部分識別結果
- `confidence`：信心度（0.0 ~ 1.0）
- `is_partial`：是否為部分結果，固定為 `true`
- `timestamp`：時間戳記
- `latency_ms`：延遲（毫秒）

#### 5. Final Transcript（Server → Client）

```json
{
  "type": "final_transcript",
  "transcript": "你好，我是護理師",
  "detected_lang": "zh",
  "translation": "Hello, I am a nurse",
  "target_lang": "en",
  "tts_audio_data": "base64_encoded_audio_data",
  "timestamp": "2025-01-25T20:30:47Z",
  "asr_latency_ms": 2350,
  "trans_latency_ms": 1290,
  "tts_latency_ms": 1500,
  "total_latency_ms": 5140
}
```

**欄位說明**：
- `type`：訊息類型，固定為 `final_transcript`
- `transcript`：完整識別結果
- `detected_lang`：偵測到的語言
- `translation`：翻譯結果
- `target_lang`：目標語言
- `tts_audio_data`：Base64 編碼的 TTS 音訊資料
- `timestamp`：時間戳記
- `asr_latency_ms`：ASR 延遲（毫秒）
- `trans_latency_ms`：翻譯延遲（毫秒）
- `tts_latency_ms`：TTS 延遲（毫秒）
- `total_latency_ms`：總延遲（毫秒）

#### 6. 錯誤訊息（Server → Client）

```json
{
  "type": "error",
  "error": "ASR failed: provider unavailable"
}
```

---

## 🎨 前端整合範例

### JavaScript WebSocket 客戶端

```javascript
class HybridASRClient {
  constructor(serverUrl, clientId, mode = 'hybrid') {
    this.ws = new WebSocket(`${serverUrl}?client_id=${clientId}&mode=${mode}`);
    this.setupHandlers();
  }
  
  setupHandlers() {
    this.ws.onopen = () => {
      console.log('[HybridASR] Connected');
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'partial_transcript':
          this.onPartialTranscript(data);
          break;
        case 'final_transcript':
          this.onFinalTranscript(data);
          break;
        case 'error':
          this.onError(data.error);
          break;
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('[HybridASR] Error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('[HybridASR] Disconnected');
    };
  }
  
  sendAudioChunk(audioData, sampleRate = 48000, format = 'webm') {
    // Convert audioData (ArrayBuffer) to Base64
    const base64Audio = this.arrayBufferToBase64(audioData);
    
    const message = {
      type: 'audio_chunk',
      audio_data: base64Audio,
      sample_rate: sampleRate,
      format: format
    };
    
    this.ws.send(JSON.stringify(message));
  }
  
  updateConfig(config) {
    const message = {
      type: 'config',
      config: config
    };
    
    this.ws.send(JSON.stringify(message));
  }
  
  stop() {
    const message = { type: 'stop' };
    this.ws.send(JSON.stringify(message));
  }
  
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  // Callbacks (override these)
  onPartialTranscript(data) {
    console.log('[Partial]', data.transcript);
  }
  
  onFinalTranscript(data) {
    console.log('[Final]', data.transcript, '→', data.translation);
    
    // Play TTS audio
    if (data.tts_audio_data) {
      const audioData = this.base64ToArrayBuffer(data.tts_audio_data);
      this.playAudio(audioData);
    }
  }
  
  onError(error) {
    console.error('[Error]', error);
  }
  
  playAudio(audioData) {
    const blob = new Blob([audioData], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  }
}

// 使用範例
const client = new HybridASRClient('ws://localhost:8080/ws/hybrid-asr', 'hospital_a', 'hybrid');

// 覆寫 callbacks
client.onPartialTranscript = (data) => {
  document.getElementById('partial-text').textContent = data.transcript;
};

client.onFinalTranscript = (data) => {
  document.getElementById('final-text').textContent = data.transcript;
  document.getElementById('translation').textContent = data.translation;
  
  // Play TTS audio
  if (data.tts_audio_data) {
    const audioData = client.base64ToArrayBuffer(data.tts_audio_data);
    client.playAudio(audioData);
  }
};

// 開始錄音並傳送
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        event.data.arrayBuffer().then(buffer => {
          client.sendAudioChunk(buffer, 48000, 'webm');
        });
      }
    };
    
    mediaRecorder.start(100); // Send chunk every 100ms
  });
```

---

## ⚙️ VAD 配置

### 預設參數

```go
rmsThreshold:      0.08   // RMS 能量閾值
silenceDuration:   1000ms // 靜音持續時間
minSpeechDuration: 300ms  // 最小語音長度
```

### 調整參數

透過 WebSocket 傳送配置訊息：

```json
{
  "type": "config",
  "config": {
    "vad_threshold": 0.10,
    "silence_duration": 1500
  }
}
```

**參數說明**：
- `vad_threshold`：提高閾值可過濾更多背景噪音，但可能漏掉輕聲說話
- `silence_duration`：延長靜音時間可避免句子被切斷，但會增加延遲

### 不同環境的建議值

| 環境 | RMS 閾值 | 靜音時間 | 說明 |
|------|---------|---------|------|
| 安靜室內 | 0.04 | 800ms | 預設值，適合安靜環境 |
| 辦公室 | 0.06 | 1000ms | 中等噪音環境 |
| 開車 | 0.08 | 1200ms | 高噪音環境 |
| 戶外 | 0.10 | 1500ms | 極高噪音環境 |

---

## 🔄 處理流程

### Hybrid 模式流程圖

```
前端傳送音訊 chunk
       ↓
   VAD 偵測
       ↓
   ┌────────────────────┐
   │  是否為語音？      │
   └────────────────────┘
       ↓           ↓
      是          否
       ↓           ↓
   ┌──────┐   ┌────────┐
   │ 並行 │   │ 等待   │
   │ 處理 │   │        │
   └──────┘   └────────┘
       ↓
   ┌─────────────────────────┐
   │ Go routine 1:           │
   │ Partial Transcript      │
   │ (streaming Whisper)     │
   │ → 即時字幕              │
   └─────────────────────────┘
       ↓
   ┌─────────────────────────┐
   │ VAD 偵測句子結束？      │
   └─────────────────────────┘
       ↓
      是
       ↓
   ┌─────────────────────────┐
   │ Go routine 2:           │
   │ Final Transcript        │
   │ (segment Whisper)       │
   │ → Translation           │
   │ → TTS                   │
   │ → 完整翻譯 + 語音       │
   └─────────────────────────┘
```

### 時間軸範例

```
時間軸：0ms ────────────────────────────────────────────────────> 5000ms

音訊 chunk：[chunk1][chunk2][chunk3][chunk4][chunk5]...

Partial:     ↓       ↓       ↓       ↓       ↓
            "你"    "你好"   "你好我"  "你好我是" (即時顯示)

VAD 偵測:                                      ↓ (靜音 1000ms)
                                              句子結束

Final:                                        ↓
                                          ASR (2350ms)
                                              ↓
                                          Translation (1290ms)
                                              ↓
                                          TTS (1500ms)
                                              ↓
                                          完整結果 + 語音
```

---

## 📊 效能優化

### 1. 並行處理

使用 Go routines 確保 partial 和 final 不互相阻塞：

```go
// Partial transcript (non-blocking)
h.wg.Add(1)
go h.processPartialTranscript(chunk, sampleRate, format)

// Final transcript (non-blocking)
h.wg.Add(1)
go h.processFinalTranscript(sampleRate, format)
```

### 2. 音訊 Chunk 大小

建議每 100ms 傳送一次 chunk：

```javascript
mediaRecorder.start(100); // 100ms interval
```

### 3. Provider 選擇

根據語言自動選擇最佳 Provider（在 `client_plans.json` 配置）：

```json
"language_providers": {
  "vi": "google_translation",
  "id": "google_translation",
  "th": "google_translation"
}
```

---

## 🧪 測試

### 1. 健康檢查

```bash
curl http://localhost:8080/health
# 輸出: OK
```

### 2. 狀態查詢

```bash
curl http://localhost:8080/status
# 輸出: {"active_connections": 2}
```

### 3. WebSocket 測試

使用 `wscat` 工具：

```bash
npm install -g wscat
wscat -c "ws://localhost:8080/ws/hybrid-asr?client_id=hospital_a&mode=hybrid"
```

傳送測試訊息：

```json
{"type":"config","config":{"mode":"hybrid","vad_threshold":0.08}}
```

---

## 🐛 故障排除

### 問題 1：連線失敗

**症狀**：WebSocket 無法連線

**解決方案**：
1. 確認伺服器已啟動：`curl http://localhost:8080/health`
2. 檢查防火牆設定
3. 確認 URL 正確：`ws://localhost:8080/ws/hybrid-asr`

### 問題 2：沒有 partial transcript

**症狀**：只收到 final transcript，沒有即時字幕

**解決方案**：
1. 確認 mode 設定為 `hybrid` 或 `stream`
2. 檢查音訊 chunk 是否正確傳送
3. 確認 VAD 閾值不要太高

### 問題 3：句子被切斷

**症狀**：一句話被分成多個 final transcript

**解決方案**：
1. 增加 `silence_duration`：
   ```json
   {"type":"config","config":{"silence_duration":1500}}
   ```
2. 調整 VAD 閾值

### 問題 4：延遲太長

**症狀**：total_latency_ms > 8000ms

**解決方案**：
1. 檢查網路延遲
2. 確認 Provider 健康狀態：`curl http://localhost:8080/status`
3. 考慮使用更快的 Provider（例如 Google Translation）
4. 減少音訊 chunk 大小

---

## 📚 進階配置

### 自訂 Provider 優先級

編輯 `configs/client_plans.json`：

```json
{
  "client_id": "hospital_a",
  "asr_config": {
    "providers": [
      {"type": "openai_asr", "priority": 100},
      {"type": "google_asr", "priority": 90}
    ],
    "routing_strategy": "latency"
  }
}
```

### 啟用成本追蹤

```json
{
  "cost_tracking": {
    "enabled": true,
    "monthly_budget": 1000.0,
    "alert_threshold": 0.8
  }
}
```

---

## 🎯 最佳實踐

1. **使用 hybrid 模式**：提供最佳使用者體驗
2. **調整 VAD 參數**：根據實際環境調整閾值和靜音時間
3. **監控延遲**：定期檢查 `total_latency_ms`，確保 < 5000ms
4. **設定 failover**：至少配置兩個 Provider 作為備援
5. **語言自動切換**：為特定語言（vi/id/th）配置最佳 Provider
6. **成本控制**：啟用成本追蹤，設定預算警告

---

## 📄 授權

MIT License
