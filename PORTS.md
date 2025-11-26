# PORT 配置管理

本文件集中管理所有服務使用的 port，防止 port 衝突。

## 🚨 重要規則

1. **禁止手動佔用以下 port**
2. **新增服務前必須先在此文件登記**
3. **修改 port 時必須同步更新此文件和相關配置**

---

## 📋 PORT 分配表

| Port | 服務名稱 | 用途 | 狀態 | 配置檔案 |
|------|---------|------|------|---------|
| **3000** | Node.js Frontend + Backend | 主要 Web 應用（Vite + Express + tRPC） | ✅ 運行中 | `server/_core/index.ts` |
| **8080** | Go Hybrid ASR Service | WebSocket 即時語音識別服務 | ⚠️ 保留 | `backend-go/cmd/api/main_hybrid.go` |
| **8081** | Go REST API Service | 語音翻譯 REST API（已停用） | ❌ 停用 | `backend-go/cmd/server/main.go` |

---

## 📝 詳細說明

### Port 3000 - Node.js Frontend + Backend
- **服務**：主要 Web 應用
- **技術棧**：Vite + React + Express + tRPC
- **功能**：
  - 前端 UI（React 19 + Tailwind 4）
  - 後端 API（tRPC + Drizzle ORM）
  - OAuth 認證
  - 語音翻譯（Node.js 後端模式）
- **啟動方式**：`pnpm dev`
- **環境變數**：無需配置（預設 3000）

### Port 8080 - Go Hybrid ASR Service
- **服務**：WebSocket 即時語音識別
- **技術棧**：Go + Gorilla WebSocket
- **功能**：
  - 即時音訊流處理
  - VAD（語音活動偵測）
  - Partial transcript（即時字幕）
  - Final transcript（完整翻譯 + TTS）
- **啟動方式**：`./bin/hybrid-asr` 或 `go run cmd/api/main_hybrid.go`
- **環境變數**：`PORT=8080`（預設）
- **前端配置**：`VITE_HYBRID_ASR_WS_URL`

### Port 8081 - Go REST API Service（已停用）
- **服務**：語音翻譯 REST API
- **狀態**：因 OpenAI API 認證問題暫時停用
- **功能**：
  - 音檔上傳
  - 語音識別（Whisper）
  - 翻譯（OpenAI）
  - TTS（文字轉語音）
- **啟動方式**：`APP_PORT=8081 go run cmd/server/main.go`
- **環境變數**：`APP_PORT=8081`
- **前端配置**：`VITE_GO_BACKEND_URL`

---

## 🔧 如何新增服務

1. **選擇可用 port**：檢查上表，選擇未使用的 port
2. **更新此文件**：在分配表中新增一行
3. **更新環境變數**：在 `.env` 或 `webdev_request_secrets` 中配置
4. **更新程式碼**：確保服務讀取正確的 port 配置
5. **測試**：確認服務正常啟動且無 port 衝突

---

## 🛡️ Port 衝突檢查

使用以下命令檢查 port 是否被佔用：

```bash
# 檢查單個 port
lsof -i :3000

# 檢查所有已分配的 port
lsof -i :3000 -i :8080 -i :8081

# 查看所有監聽的 port
netstat -tlnp | grep LISTEN
```

---

## 📌 注意事項

1. **開發環境**：所有服務預設監聽 `localhost`
2. **生產環境**：透過 Manus 平台自動處理 port 映射
3. **WebSocket**：Hybrid ASR 使用 WebSocket 協議（`ws://` 或 `wss://`）
4. **CORS**：Node.js 後端已配置 CORS，允許跨域請求

---

## 🔄 變更歷史

| 日期 | 變更內容 | 負責人 |
|------|---------|--------|
| 2025-11-26 | 初始建立 PORT 配置文件 | System |
| 2025-11-26 | 停用 Go REST API Service (8081) | System |

---

## 📞 聯絡資訊

如有 port 衝突或配置問題，請：
1. 檢查此文件確認 port 分配
2. 使用 `lsof` 命令診斷衝突
3. 更新此文件並提交變更
