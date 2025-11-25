# Go 後端整合指南

## 專案概述

本專案正在將後端從 Node.js (tRPC) 遷移到 Go (Gin + GORM + PostgreSQL)，前端保持 React + TypeScript。

## Go 後端架構

### 目錄結構

```
backend-go/
├── cmd/
│   └── api/
│       └── main.go              # 應用程式入口點
├── internal/
│   ├── config/
│   │   └── config.go            # 配置管理
│   ├── models/
│   │   └── models.go            # 資料庫模型
│   ├── services/
│   │   ├── asr.go               # 語音識別服務 (Whisper)
│   │   ├── translation.go       # 翻譯服務 (GPT-4o-mini)
│   │   └── tts.go               # 語音合成服務 (TTS-1)
│   ├── handlers/
│   │   ├── rest.go              # REST API 處理器
│   │   └── websocket.go         # WebSocket 處理器
│   └── middleware/
│       ├── cors.go              # CORS 中介軟體
│       ├── requestid.go         # 請求 ID 中介軟體
│       └── logger.go            # 日誌中介軟體
├── go.mod
└── go.sum
```

### 資料庫模型

#### Device（設備）
```go
type Device struct {
    ID        uint      `gorm:"primaryKey"`
    DeviceID  string    `gorm:"uniqueIndex;not null"`
    Name      string
    Location  string
    Status    string    `gorm:"default:active"`
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

#### ClientPlan（客戶方案）
```go
type ClientPlan struct {
    ID                uint      `gorm:"primaryKey"`
    DeviceID          uint      `gorm:"not null"`
    Device            Device    `gorm:"foreignKey:DeviceID"`
    PlanName          string
    MaxMonthlyMinutes int
    UsedMinutes       int       `gorm:"default:0"`
    StartDate         time.Time
    EndDate           time.Time
    CreatedAt         time.Time
    UpdatedAt         time.Time
}
```

#### Session（會話）
```go
type Session struct {
    ID        uint      `gorm:"primaryKey"`
    DeviceID  uint      `gorm:"not null"`
    Device    Device    `gorm:"foreignKey:DeviceID"`
    StartTime time.Time
    EndTime   *time.Time
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

#### Transcript（語音識別結果）
```go
type Transcript struct {
    ID               uint      `gorm:"primaryKey"`
    SessionID        uint      `gorm:"not null"`
    Session          Session   `gorm:"foreignKey:SessionID"`
    AudioURL         string
    TranscriptText   string    `gorm:"type:text"`
    DetectedLanguage string
    Confidence       float64
    CreatedAt        time.Time
}
```

#### Translation（翻譯結果）
```go
type Translation struct {
    ID           uint       `gorm:"primaryKey"`
    TranscriptID uint       `gorm:"not null"`
    Transcript   Transcript `gorm:"foreignKey:TranscriptID"`
    SourceLang   string
    TargetLang   string
    SourceText   string     `gorm:"type:text"`
    TranslatedText string   `gorm:"type:text"`
    CreatedAt    time.Time
}
```

#### Diagnostic（診斷數據）
```go
type Diagnostic struct {
    ID                   uint      `gorm:"primaryKey"`
    SessionID            uint
    Session              Session   `gorm:"foreignKey:SessionID"`
    ASRLatency           int       // 毫秒
    LanguageDetectLatency int      // 毫秒
    TranslationLatency   int       // 毫秒
    TTSLatency           int       // 毫秒
    TotalLatency         int       // 毫秒
    CreatedAt            time.Time
}
```

## API 端點

### 1. REST API - Segment Mode（片段模式）

**端點**: `POST /api/v1/asr/segment`

**用途**: 處理完整的音訊片段，適合批次處理

**請求格式**: `multipart/form-data`

**參數**:
- `audio` (file, required): 音訊檔案（支援 webm, mp3, wav, ogg, m4a）
- `sessionId` (string, optional): 會話 ID
- `deviceId` (string, optional): 設備 ID

**回應格式**:
```json
{
  "transcript": "你好，我需要幫助",
  "detectedLanguage": "zh",
  "translation": "Hello, I need help",
  "targetLanguage": "en",
  "ttsAudioUrl": "https://storage.example.com/audio/tts-xxx.mp3",
  "diagnostics": {
    "asrLatency": 1200,
    "languageDetectLatency": 300,
    "translationLatency": 800,
    "ttsLatency": 1500,
    "totalLatency": 3800
  }
}
```

**範例（使用 fetch）**:
```typescript
const formData = new FormData();
formData.append('audio', audioBlob, 'audio.webm');
formData.append('sessionId', sessionId);
formData.append('deviceId', deviceId);

const response = await fetch('http://localhost:8080/api/v1/asr/segment', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Transcript:', result.transcript);
console.log('Translation:', result.translation);
```

### 2. WebSocket API - Streaming Mode（串流模式）

**端點**: `GET /ws/asr/stream`

**用途**: 即時串流處理，適合持續對話

**訊息格式**: JSON

#### 客戶端 → 伺服器

**開始會話**:
```json
{
  "type": "start",
  "sessionId": "session-123",
  "deviceId": "device-456"
}
```

**發送音訊數據**:
```json
{
  "type": "audio",
  "data": "base64-encoded-audio-data"
}
```

**結束會話**:
```json
{
  "type": "end"
}
```

#### 伺服器 → 客戶端

**識別結果**:
```json
{
  "type": "transcript",
  "transcript": "你好，我需要幫助",
  "detectedLanguage": "zh"
}
```

**翻譯結果**:
```json
{
  "type": "translation",
  "translation": "Hello, I need help",
  "targetLanguage": "en"
}
```

**TTS 音訊 URL**:
```json
{
  "type": "tts",
  "audioUrl": "https://storage.example.com/audio/tts-xxx.mp3"
}
```

**診斷數據**:
```json
{
  "type": "diagnostics",
  "diagnostics": {
    "asrLatency": 1200,
    "languageDetectLatency": 300,
    "translationLatency": 800,
    "ttsLatency": 1500,
    "totalLatency": 3800
  }
}
```

**錯誤訊息**:
```json
{
  "type": "error",
  "error": "Error message here"
}
```

**範例（使用 WebSocket）**:
```typescript
const ws = new WebSocket('ws://localhost:8080/ws/asr/stream');

ws.onopen = () => {
  // 開始會話
  ws.send(JSON.stringify({
    type: 'start',
    sessionId: 'session-123',
    deviceId: 'device-456'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'transcript':
      console.log('Transcript:', message.transcript);
      console.log('Language:', message.detectedLanguage);
      break;
    case 'translation':
      console.log('Translation:', message.translation);
      break;
    case 'tts':
      console.log('TTS Audio URL:', message.audioUrl);
      break;
    case 'diagnostics':
      console.log('Diagnostics:', message.diagnostics);
      break;
    case 'error':
      console.error('Error:', message.error);
      break;
  }
};

// 發送音訊數據
function sendAudio(audioBlob: Blob) {
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = (reader.result as string).split(',')[1];
    ws.send(JSON.stringify({
      type: 'audio',
      data: base64
    }));
  };
  reader.readAsDataURL(audioBlob);
}

// 結束會話
function endSession() {
  ws.send(JSON.stringify({ type: 'end' }));
  ws.close();
}
```

## 環境變數配置

在 `backend-go/` 目錄下建立 `.env` 檔案：

```env
# 伺服器配置
PORT=8080

# 資料庫配置（PostgreSQL）
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=realtime_translation
DB_SSLMODE=disable

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key

# CORS 配置
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
```

## 啟動 Go 後端

### 1. 安裝依賴

```bash
cd backend-go
go mod download
```

### 2. 設定資料庫

使用 Docker 啟動 PostgreSQL：

```bash
docker run -d \
  --name postgres-realtime-translation \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=realtime_translation \
  -p 5432:5432 \
  postgres:16-alpine
```

或建立 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres-realtime-translation
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: realtime_translation
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

啟動：
```bash
docker-compose up -d
```

### 3. 執行伺服器

```bash
cd backend-go
go run cmd/api/main.go
```

伺服器將在 `http://localhost:8080` 啟動。

### 4. 驗證伺服器運行

```bash
curl http://localhost:8080/health
```

應該回傳：
```json
{"status": "ok"}
```

## 前端整合步驟

### 方案 A：使用 REST API（推薦用於簡單場景）

適合：批次處理、單次翻譯請求

**修改 `client/src/pages/Home.tsx`**:

```typescript
// 移除 tRPC 相關 import
// import { trpc } from "@/lib/trpc";

// 新增 API 配置
const API_BASE_URL = 'http://localhost:8080';

// 修改翻譯函數
async function translateAudio(audioBlob: Blob, sessionId: string) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');
  formData.append('sessionId', sessionId);
  formData.append('deviceId', 'web-client-001');

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/asr/segment`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}
```

### 方案 B：使用 WebSocket（推薦用於即時對話）

適合：持續對話、即時回饋

**建立 WebSocket 服務 `client/src/services/websocket.ts`**:

```typescript
export interface TranscriptMessage {
  type: 'transcript';
  transcript: string;
  detectedLanguage: string;
}

export interface TranslationMessage {
  type: 'translation';
  translation: string;
  targetLanguage: string;
}

export interface TTSMessage {
  type: 'tts';
  audioUrl: string;
}

export interface DiagnosticsMessage {
  type: 'diagnostics';
  diagnostics: {
    asrLatency: number;
    languageDetectLatency: number;
    translationLatency: number;
    ttsLatency: number;
    totalLatency: number;
  };
}

export interface ErrorMessage {
  type: 'error';
  error: string;
}

export type ServerMessage = 
  | TranscriptMessage 
  | TranslationMessage 
  | TTSMessage 
  | DiagnosticsMessage 
  | ErrorMessage;

export class RealtimeTranslationWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string;
  private deviceId: string;

  constructor(url: string, sessionId: string, deviceId: string) {
    this.url = url;
    this.sessionId = sessionId;
    this.deviceId = deviceId;
  }

  connect(
    onMessage: (message: ServerMessage) => void,
    onError?: (error: Event) => void,
    onClose?: (event: CloseEvent) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        // 發送開始訊息
        this.send({
          type: 'start',
          sessionId: this.sessionId,
          deviceId: this.deviceId,
        });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (onClose) onClose(event);
      };
    });
  }

  sendAudio(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        this.send({
          type: 'audio',
          data: base64,
        });
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  endSession() {
    this.send({ type: 'end' });
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not open');
    }
  }
}
```

**修改 `client/src/pages/Home.tsx` 使用 WebSocket**:

```typescript
import { RealtimeTranslationWebSocket, ServerMessage } from '@/services/websocket';

export default function Home() {
  const [ws, setWs] = useState<RealtimeTranslationWebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  // 開始對話
  const startConversation = async () => {
    const websocket = new RealtimeTranslationWebSocket(
      'ws://localhost:8080/ws/asr/stream',
      sessionId,
      'web-client-001'
    );

    try {
      await websocket.connect(
        handleServerMessage,
        handleError,
        handleClose
      );
      setWs(websocket);
      setIsRecording(true);
      startRecording(websocket);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  // 處理伺服器訊息
  const handleServerMessage = (message: ServerMessage) => {
    switch (message.type) {
      case 'transcript':
        console.log('Transcript:', message.transcript);
        console.log('Language:', message.detectedLanguage);
        // 更新 UI 顯示即時字幕
        break;
      case 'translation':
        console.log('Translation:', message.translation);
        // 更新 UI 顯示翻譯結果
        break;
      case 'tts':
        console.log('TTS Audio URL:', message.audioUrl);
        // 播放 TTS 音訊（如果需要）
        break;
      case 'diagnostics':
        console.log('Diagnostics:', message.diagnostics);
        // 顯示診斷數據
        break;
      case 'error':
        console.error('Server error:', message.error);
        break;
    }
  };

  // 錯誤處理
  const handleError = (error: Event) => {
    console.error('WebSocket error:', error);
  };

  // 連線關閉處理
  const handleClose = (event: CloseEvent) => {
    console.log('Connection closed:', event.code, event.reason);
    setIsRecording(false);
  };

  // 開始錄音
  const startRecording = async (websocket: RealtimeTranslationWebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          await websocket.sendAudio(event.data);
        }
      };

      // 每 1 秒發送一次音訊數據
      mediaRecorder.start(1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // 結束對話
  const endConversation = () => {
    if (ws) {
      ws.endSession();
      ws.close();
      setWs(null);
    }
    setIsRecording(false);
  };

  return (
    <div>
      {!isRecording ? (
        <button onClick={startConversation}>開始對話</button>
      ) : (
        <button onClick={endConversation}>結束對話</button>
      )}
    </div>
  );
}
```

## 語言偵測邏輯

Go 後端實作了智慧語言偵測：

1. **Whisper API 語言偵測**: 使用 OpenAI Whisper API 的內建語言偵測功能
2. **GPT-4o-mini 語言分類**: 對 Whisper 的文字結果進行二次確認，準確率接近 100%

**支援的語言**:
- 中文 (zh, zh-tw, zh-cn, cmn, yue)
- 越南語 (vi)
- 印尼語 (id)
- 菲律賓語 (tl, fil)
- 英文 (en)
- 義大利語 (it)
- 日文 (ja)
- 韓文 (ko)
- 泰文 (th)

**翻譯方向**:
- 中文 → 使用者選擇的目標語言
- 其他語言 → 中文

## 診斷系統

Go 後端內建完整的延遲追蹤系統，記錄每個處理步驟的時間：

- **ASR Latency**: Whisper API 語音識別時間
- **Language Detect Latency**: 語言偵測時間
- **Translation Latency**: GPT-4o-mini 翻譯時間
- **TTS Latency**: TTS-1 語音合成時間
- **Total Latency**: 端到端總時間

所有診斷數據都會儲存到 `diagnostics` 表，並在 API 回應中回傳。

## 測試

### 測試 REST API

```bash
# 準備測試音訊檔案
curl -X POST http://localhost:8080/api/v1/asr/segment \
  -F "audio=@test-audio.webm" \
  -F "sessionId=test-session-123" \
  -F "deviceId=test-device-001"
```

### 測試 WebSocket

使用瀏覽器開發者工具或 WebSocket 測試工具（如 wscat）：

```bash
npm install -g wscat
wscat -c ws://localhost:8080/ws/asr/stream
```

發送訊息：
```json
{"type":"start","sessionId":"test-123","deviceId":"test-001"}
```

## 效能優化建議

1. **連線池**: GORM 已設定資料庫連線池，預設最大連線數為 10
2. **快取**: 可考慮使用 Redis 快取翻譯結果
3. **負載平衡**: 使用 Nginx 或 HAProxy 進行負載平衡
4. **監控**: 整合 Prometheus + Grafana 監控系統效能

## 故障排除

### 問題 1: 資料庫連線失敗

**錯誤訊息**: `failed to connect to database`

**解決方案**:
1. 確認 PostgreSQL 正在運行：`docker ps`
2. 檢查 `.env` 檔案中的資料庫配置
3. 測試資料庫連線：`psql -h localhost -U postgres -d realtime_translation`

### 問題 2: OpenAI API 錯誤

**錯誤訊息**: `OpenAI API error: 401 Unauthorized`

**解決方案**:
1. 確認 `OPENAI_API_KEY` 已正確設定
2. 檢查 API key 是否有效：`curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

### 問題 3: CORS 錯誤

**錯誤訊息**: `Access to fetch at 'http://localhost:8080' from origin 'http://localhost:3000' has been blocked by CORS policy`

**解決方案**:
1. 確認 `.env` 中的 `CORS_ALLOWED_ORIGINS` 包含前端網址
2. 重啟 Go 後端伺服器

## 下一步

1. ✅ Go 後端已完成並測試
2. ⏳ 前端整合（選擇 REST API 或 WebSocket）
3. ⏳ 端到端測試
4. ⏳ 部署到生產環境

## 參考資料

- [Gin Web Framework](https://gin-gonic.com/)
- [GORM ORM](https://gorm.io/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
