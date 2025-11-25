# Go 後端重建 TODO

## Phase 1: 建立 Go 後端基礎架構
- [x] 建立 Go 專案結構（cmd, internal, pkg）
- [x] 初始化 Go module
- [x] 建立 main.go 入口檔案
- [x] 建立 config.go 設定檔
- [ ] 設定 Gin 框架
- [ ] 設定 GORM + PostgreSQL 連線
- [ ] 設定 CORS 中介軟體

## Phase 2: 實作資料庫 schema 和 models
- [ ] 定義 User model
- [ ] 定義 Conversation model
- [ ] 定義 Translation model
- [ ] 定義 LanguageConfig model
- [ ] 執行資料庫遷移

## Phase 3: 實作 ASR/翻譯/TTS 服務整合
- [ ] 實作 Whisper ASR 服務（Manus API / OpenAI）
- [ ] 實作 GPT-4o-mini 翻譯服務
- [ ] 實作 OpenAI TTS 服務
- [ ] 實作語言偵測邏輯

## Phase 4: 實作 REST API
- [ ] POST /api/conversations - 建立對話
- [ ] GET /api/conversations - 查詢對話列表
- [ ] GET /api/conversations/:id - 查詢對話詳情
- [ ] POST /api/conversations/:id/end - 結束對話
- [ ] POST /api/translations - 儲存翻譯記錄
- [ ] GET /api/translations/:conversationId - 查詢翻譯記錄

## Phase 5: 實作 WebSocket
- [ ] 實作 WebSocket 連線管理
- [ ] 實作 segment 模式（完整句子後翻譯）
- [ ] 實作 streaming 模式（即時翻譯）
- [ ] 實作音訊上傳和處理
- [ ] 實作 TTS 音訊串流回傳

## Phase 6: 修改前端 API 呼叫
- [ ] 移除 tRPC 相關程式碼
- [ ] 實作 REST API 呼叫（axios）
- [ ] 實作 WebSocket 連線
- [ ] 實作 segment/streaming 模式切換
- [ ] 測試前後端整合

## Phase 7: 測試完整功能
- [ ] 測試 ASR 語音識別
- [ ] 測試翻譯功能
- [ ] 測試 TTS 語音合成
- [ ] 測試 segment 模式
- [ ] 測試 streaming 模式
- [ ] 測試對話歷史儲存和查詢
