# Go Backend for Realtime Translation System

## 概述

這是即時雙向翻譯系統的 Go 後端，使用 Gin + GORM + PostgreSQL 架構。

## 功能特色

- ✅ REST API（Segment Mode）：處理完整音訊片段
- ✅ WebSocket API（Streaming Mode）：即時串流處理
- ✅ 語音識別（OpenAI Whisper API）
- ✅ 智慧語言偵測（Whisper + GPT-4o-mini 雙階段）
- ✅ 翻譯服務（GPT-4o-mini）
- ✅ 語音合成（OpenAI TTS-1）
- ✅ 完整診斷系統（延遲追蹤）
- ✅ GORM AutoMigrate（自動資料庫遷移）

## 快速開始

### 1. 安裝依賴

```bash
go mod download
```

### 2. 設定環境變數

建立 `.env` 檔案（參考 `.env.example`）：

```env
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres123
DB_NAME=realtime_translation
DB_SSLMODE=disable
OPENAI_API_KEY=sk-your-api-key
CORS_ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info
```

### 3. 啟動 PostgreSQL

使用 Docker Compose：

```bash
docker-compose up -d
```

或手動啟動：

```bash
docker run -d \
  --name postgres-realtime-translation \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres123 \
  -e POSTGRES_DB=realtime_translation \
  -p 5432:5432 \
  postgres:16-alpine
```

### 4. 執行伺服器

```bash
go run cmd/api/main.go
```

伺服器將在 `http://localhost:8080` 啟動。

### 5. 驗證

```bash
curl http://localhost:8080/health
```

應該回傳：
```json
{"status": "ok"}
```

## API 端點

### REST API

**POST /api/v1/asr/segment**

處理完整音訊片段，回傳識別、翻譯、TTS 結果。

範例：
```bash
curl -X POST http://localhost:8080/api/v1/asr/segment \
  -F "audio=@test.webm" \
  -F "sessionId=session-123" \
  -F "deviceId=device-001"
```

### WebSocket API

**GET /ws/asr/stream**

即時串流處理，支援持續對話。

範例（使用 wscat）：
```bash
npm install -g wscat
wscat -c ws://localhost:8080/ws/asr/stream

# 發送訊息
{"type":"start","sessionId":"session-123","deviceId":"device-001"}
{"type":"audio","data":"base64-encoded-audio"}
{"type":"end"}
```

## 專案結構

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
│   │   ├── asr.go               # 語音識別服務
│   │   ├── translation.go       # 翻譯服務
│   │   └── tts.go               # 語音合成服務
│   ├── handlers/
│   │   ├── rest.go              # REST API 處理器
│   │   └── websocket.go         # WebSocket 處理器
│   └── middleware/
│       ├── cors.go              # CORS 中介軟體
│       ├── requestid.go         # 請求 ID 中介軟體
│       └── logger.go            # 日誌中介軟體
├── go.mod
├── go.sum
├── docker-compose.yml           # PostgreSQL 配置
└── README.md
```

## 資料庫模型

- **Device**: 設備管理
- **ClientPlan**: 客戶方案（使用量追蹤）
- **Session**: 對話會話
- **Transcript**: 語音識別結果
- **Translation**: 翻譯結果
- **Diagnostic**: 診斷數據（延遲追蹤）

GORM 會在伺服器啟動時自動建立表格（AutoMigrate）。

## 支援的語言

- 中文 (zh, zh-tw, zh-cn, cmn, yue)
- 越南語 (vi)
- 印尼語 (id)
- 菲律賓語 (tl, fil)
- 英文 (en)
- 義大利語 (it)
- 日文 (ja)
- 韓文 (ko)
- 泰文 (th)

## 診斷系統

系統會自動追蹤每個處理步驟的延遲：

- ASR Latency（Whisper API）
- Language Detect Latency（語言偵測）
- Translation Latency（翻譯）
- TTS Latency（語音合成）
- Total Latency（端到端）

所有診斷數據都會儲存到資料庫並在 API 回應中回傳。

## 編譯

### 開發模式

```bash
go run cmd/api/main.go
```

### 生產編譯

```bash
go build -o realtime-translation-api cmd/api/main.go
./realtime-translation-api
```

### 交叉編譯

Linux:
```bash
GOOS=linux GOARCH=amd64 go build -o realtime-translation-api-linux cmd/api/main.go
```

macOS:
```bash
GOOS=darwin GOARCH=amd64 go build -o realtime-translation-api-macos cmd/api/main.go
```

Windows:
```bash
GOOS=windows GOARCH=amd64 go build -o realtime-translation-api.exe cmd/api/main.go
```

## 測試

```bash
go test ./...
```

## 故障排除

### 資料庫連線失敗

1. 確認 PostgreSQL 正在運行：`docker ps`
2. 檢查 `.env` 中的資料庫配置
3. 測試連線：`psql -h localhost -U postgres -d realtime_translation`

### OpenAI API 錯誤

1. 確認 `OPENAI_API_KEY` 已正確設定
2. 檢查 API key 是否有效
3. 確認帳戶有足夠的額度

### CORS 錯誤

1. 確認 `.env` 中的 `CORS_ALLOWED_ORIGINS` 包含前端網址
2. 重啟伺服器

## 效能優化

- 資料庫連線池（預設最大 10 個連線）
- Gin 的 Release 模式（生產環境）
- GORM 的預載入（Preload）減少查詢次數

## 部署

### Docker

建立 `Dockerfile`：

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o main cmd/api/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

建置並執行：

```bash
docker build -t realtime-translation-api .
docker run -p 8080:8080 --env-file .env realtime-translation-api
```

## 授權

MIT License

## 聯絡

如有問題請聯絡開發團隊。
