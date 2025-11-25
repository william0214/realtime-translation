# 即時雙向翻譯系統 - 任務清單

## 專案架構
- [x] 設計資料庫 schema（翻譯記錄、語言配置）
- [x] 建立後端 API 路由結構

## 後端 API 開發
- [x] 實作 /asr 語音識別端點（Whisper API 整合）
- [x] 實作 /translate 翻譯端點（OpenAI GPT 整合）
- [x] 實作 /tts 文字轉語音端點（OpenAI Audio TTS 整合）
- [x] 實作 /auto_translate 整合端點（ASR + 翻譯 + TTS）
- [x] 實作自動語言偵測與角色判斷邏輯
- [x] 建立語言配置管理（中文/越南語/印尼語/菲律賓語/英文）

## 前端開發
- [x] 設計透明螢幕 UI 版面（黑色半透明背景）
- [x] 實作連續錄音功能（MediaRecorder API，每 2 秒切片）
- [x] 實作雙字幕顯示區（Primary 大字 + Secondary 小字）
- [x] 實作字幕自動更新邏輯（根據翻譯方向切換顯示）
- [x] 實作 TTS 音訊自動播放功能
- [x] 實作全螢幕透明模式

## 測試與優化
- [x] 測試中文轉越南語翻譯流程
- [x] 測試越南語轉中文翻譯流程
- [x] 測試多語言自動偵測準確度
- [x] 測試連續對話場景
- [x] 優化音訊處理延遲
- [x] 優化字幕顯示效果

## 文件與部署
- [x] 撰寫 README 使用說明
- [x] 建立 Demo 測試腳本
- [x] 建立專案檢查點

## Bug 修正
- [x] 修正 Whisper API multipart form 解析錯誤
- [x] 修正 React useEffect 清理函數錯誤
- [x] 修正 React DOM insertBefore 錯誤（重構錄音邏輯）
- [x] 修正 require is not defined 錯誤（改用 ES Module import）
- [x] 重寫 Whisper API 呼叫（使用 OpenAI SDK）
- [x] 改用 axios + form-data 上傳音訊（最穩定方式）
- [x] 修正 TTS 音訊播放中斷錯誤
- [x] 改為連續錄音模式（不需按停止）
- [x] 修改按鈕文字為「開始對話」和「結束對話」
- [x] 移除 TTS 語音播放功能
- [x] 重設顯示邏輯，顯示雙方對話記錄
- [x] 修正翻譯提示詞，移除不必要的解釋文字
- [x] 修改介面文字（移除「護理推車」，改為「台灣人」和「外國人」）

## 功能優化
- [x] 加入「清除對話」按鈕
- [x] 顯示偵測到的語言標籤
- [x] 實作匯出對話記錄功能
- [x] 移除網頁標題中的「護理推車」字樣
- [x] 加入語言選擇器功能
- [x] 修正語言判斷邏輯（中文永遠是台灣人）
- [ ] 修正前端顯示邏輯（中文對話顯示在台灣人區域）
- [x] 修正音訊格式問題（增加錄音長度、檢查檔案大小）
- [x] 修正資料庫插入錯誤（移除資料庫儲存功能）

## VAD 功能
- [x] 實作語音活動偵測（VAD）
- [x] 加入音量檢測與閥值判斷
- [x] 顯示即時音量指示器

## 系統優化
- [x] 改用 WAV 格式錄音（取代 WebM）
- [x] 改進 VAD 邏輯（使用 RMS 音量檢測）
- [x] 加入即時處理狀態顯示

## Bug 修正
- [x] 修正語言偵測顯示 unknown 的問題（預設為中文）
- [x] 加入詳細日誌記錄 Whisper API 回應
- [x] 修正中文被誤判為外國人的問題
- [x] 實作解法 1：加入 Whisper API 語言提示 (language=zh)
- [x] 實作解法 2：二階段語言偵測（使用 LLM 分類）
- [x] 測試語音識別功能

## 激進速度優化（解決系統仍然很慢的問題）
- [x] 診斷當前速度瓶頸（測量每個步驟的時間）
- [x] 移除不必要的 API 呼叫
- [x] 簡化語言偵測邏輯（移除 LLM 二階段，只用 Whisper + 語言提示）
- [x] 測試優化後的速度

## UI 改進
- [x] 實作對話區域自動滾動到最新訊息

## 速度優化 v2
- [x] 移除 WAV 轉換步驟（直接使用 WebM）
- [x] 更新 Whisper API 呼叫邏輯
- [x] 測試 WebM 直接送 Whisper 的效果

## WebM 直接串流最佳化（300-800ms chunk + 雙階段語言判斷）
- [x] 前端錄音改用 WebM (opus)，chunk interval 300-800ms
- [x] 實作前端 VAD（RMS 0.02，800ms 靜音判定）
- [x] 後端直接處理 WebM，不轉 WAV
- [x] Whisper API 優化（temperature=0, response_format=json）
- [x] 實作雙階段語言判斷（Whisper transcript → LLM 分類）
- [x] 新增 API 端點：/audio/chunk
- [x] 新增 API 端點：/language/identify
- [x] 新增 API 端點：/translate
- [x] 新增 API 端點：/tts
- [x] 實作 UI 狀態顯示（listening, vad-detected, recognizing, translating, speaking）
- [x] 性能測試（目標：全流程延遲 ≦ 1 秒）

## Bug 修復
- [x] 修復「一直等待語音」問題（VAD 未正確觸發處理）

## WebM Chunk Buffer + FFmpeg 封裝方案
- [x] 前端改回 chunk-based 錄音（300-800ms interval）
- [x] 前端即時發送 WebM chunks 到後端
- [x] 後端實作 chunk buffer（依 session 管理）
- [x] 後端使用 ffmpeg 合併 chunks 並重新封裝為完整 WebM
- [x] VAD 偵測語音段落結束時觸發合併
- [x] 完整 WebM 送 Whisper API（temperature=0, response_format=json）
- [x] 測試 pseudo-streaming 效能（延遲 < 1 秒）

## Bug 修復 v2
- [x] 診斷「並無字幕產生」問題（ffmpeg concat 失敗）
- [x] 修復 chunk 合併邏輯（改用 Buffer.concat）
- [x] 測試字幕顯示功能

## 修正 WebM Chunk 合併方式（使用 Blob）
- [x] 前端收集 WebM chunks（300-800ms interval）
- [x] VAD 偵測語音段落結束時建立 Blob
- [x] 使用 `new Blob(chunks, { type: "audio/webm" })` 合併
- [x] 直接送 Blob 到 Whisper API
- [x] 移除後端 chunk buffer 邏輯
- [x] 移除所有 ffmpeg 相關程式碼
- [x] 測試 Whisper API 可正確解析多 header WebM

## VAD 控制的智能 Chunk 切割
- [x] VAD 偵測語音起點（無聲 → 有聲，RMS > 0.02）
- [x] 語音起點時開始收集 chunks 到 buffer
- [x] 語音段落中持續 push chunks
- [x] VAD 偵測語音終點（有聲 → 無聲，持續 800ms）
- [x] 語音終點時合併 chunks（new Blob）
- [x] 送完整 WebM 到 Whisper API
- [x] 測試延遲（目標 0.8-1.2 秒）
- [x] 測試準確度與成本

## AudioWorklet + WebM Muxer 方案
- [x] 安裝 webm-muxer 套件
- [x] 實作 AudioWorklet 處理器（取得 raw PCM）
- [x] 整合 VAD 控制（語音起點→收集 PCM→終點→finalize）
- [x] 使用 WebM Muxer 封裝完整 WebM（含 EBML header + metadata）
- [x] 移除 MediaRecorder chunks 合併邏輯
- [x] 測試 Whisper API 可正確解析完整 WebM
- [x] 驗證無 "Invalid file format" 錯誤

## 雙軌處理架構（即時字幕 + 完整翻譯 + TTS）
- [x] 設定 MAX_SEGMENT_DURATION = 1.0 秒
- [x] 實作 1 秒 chunk 即時字幕（Whisper, temperature=0, response_format=json）
- [x] 實作 VAD 語句級切段（完整句子）
- [x] 實作翻譯 API（gpt-4o-mini）
- [x] 實作 TTS API（gpt-4o-mini-tts）
- [x] 整合雙軌處理流程
- [x] 測試全流程速度（目標 0.8-1.3 秒）

## 功能調整
- [x] 關閉 TTS 自動播放功能

## 自動化延遲分析與瓶頸診斷模組
- [x] 建立 Profiler 架構（/server/profiler/）
- [x] 實作 ASR Profiler（Whisper API 延遲）
- [x] 實作 Translation Profiler（翻譯 API 延遲）
- [x] 實作 TTS Profiler（TTS API 延遲）
- [x] 實作 Chunk Profiler（chunk 大小與時長）
- [x] 實作 E2E Profiler（端到端總延遲）
- [x] 實作 Bottleneck 檢測器（自動判斷瓶頸）
- [x] 建立後端 /diagnostics/report API
- [x] 建立前端 Diagnostic Dashboard（可視化）
- [x] 串接 Profiler 到實際流程（VAD、Whisper、翻譯、TTS）
- [x] 測試診斷模組功能

## 速度瓶頸診斷
- [x] 觸發翻譯流程產生診斷數據（建立診斷查看工具）
- [ ] 查看診斷報告分析瓶頸
- [ ] 提供優化建議

## Bug 修復 v3
- [x] 修復 Whisper 幻覚問題（靜音時出現 thank you/bye）
- [x] 加入 VAD 過濾（只在真正有聲音時才送 Whisper）

## VAD 閾值優化
- [x] 調高 VAD 音量閾值（0.02 → 0.04）改善語音段落切割

## 翻譯速度優化（3 秒延遲過長）
- [x] 檢查診斷報告分析延遲瓶頸（ASR、翻譯、網路）
- [x] 實施針對性優化方案（移除 LLM 語言偵測，使用 Whisper 的語言偵測）
- [x] 修復 diagnosticsStore 共享問題（改用靜態 import）
- [ ] 測試優化後的速度（等待用戶反饋）

## 翻譯結果顯示異常（出現大量不該顯示的文字）
- [x] 診斷翻譯 API 回傳內容（發現 invokeLLM 啟用了思考模式）
- [x] 修復翻譯提示詞（明確禁用思考模式 thinking: false）
- [x] 修改 invokeLLM 讓思考模式可選，預設關閉
- [x] 測試修復效果（確認只顯示簡潔翻譯結果）

## 句子結束即時翻譯（偵測標點符號立即觸發翻譯）
- [x] 設計句子結束偵測邏輯（中文標點：。？！，；英文標點：. ? ! , ;）
- [x] 實作前端標點符號偵測（在即時字幕更新時檢查）
- [x] 觸發翻譯時清空當前累積的語音緩衝
- [x] 保留 VAD 靜音判定作為備用機制
- [ ] 測試句子結束翻譯效果（等待用戶反饋）

## 處理狀態指示器
- [x] 設計狀態指示器 UI（顯示「正在識別」、「正在翻譯」等狀態）
- [x] 實作狀態指示器元件（已存在，優化顯示效果）
- [x] 整合到翻譯流程中（已存在）
- [x] 加入動畫效果（animate-pulse）和顏色區分

## 對話歷史儲存
- [x] 設計對話歷史資料庫 schema（conversations 表 + 修改 translations 表）
- [x] 推送資料庫 schema 更新（pnpm db:push）
- [x] 實作對話歷史儲存 API（tRPC procedure）
- [x] 編寫對話歷史 API 測試（全部通過）
- [x] 修改前端，翻譯完成後自動儲存到資料庫
  - [x] 開始對話時建立 conversation session
  - [x] 翻譯完成後自動儲存
  - [x] 結束對話時標記 conversation
- [x] 實作歷史查看頁面
  - [x] 建立 /history 路由和頁面檔案
  - [x] 實作對話列表顯示（含翻譯數量統計）
  - [x] 實作對話詳細內容查看（Dialog 顯示）
  - [x] 實作篩選功能（日期、語言）
  - [x] 實作匯出功能（CSV/JSON）
  - [x] 在 Home 頁面加入歷史查看按鈕
- [x] 測試對話歷史儲存和查看功能（整合測試全部通過）
- [x] 測試歷史查看頁面功能（列表、詳細、篩選、全部通過）

## VAD 閾值調整介面
- [ ] 設計 VAD 閾值調整 UI（滑桿元件）
- [ ] 實作設定選單（包含閾值調整）
- [ ] 儲存使用者偏好設定（localStorage）
- [ ] 動態更新 VAD 閾值
- [ ] 測試閾值調整效果

## 手機版響應式佈局
- [x] 設計手機版佈局（上下框取代左右框）
- [x] 實作響應式 CSS（使用 Tailwind breakpoints md:）
- [x] 調整對話框方向（外國人框 rotate-180，桌面版恢復 md:rotate-0）
- [x] 優化 Header、狀態列、按鈕的響應式設計
- [x] 測試手機版顯示效果（使用開發者工具設備模擬）

## 前端連接 Go 後端（進行中）
- [x] 建立完整的 Go 後端整合指南（GO_BACKEND_INTEGRATION_GUIDE.md）
- [x] 提供 REST API 整合範例
- [x] 提供 WebSocket 整合範例
- [x] 建立 PostgreSQL Docker Compose 配置
- [x] 建立 Go 後端 README
- [ ] 建立 WebSocket 客戶端服務
- [ ] 修改 Home.tsx 使用 WebSocket
- [ ] 移除 tRPC 相關程式碼
- [ ] 測試前後端整合

## Node.js 開發伺服器修復
- [x] 修復 server/db.ts 語法錯誤（重啟伺服器清除快取）
- [x] 驗證 TypeScript 編譯無誤
- [x] 驗證開發伺服器正常運行

## Go 後端開發（Phase 1 完成）
- [x] 建立 Go 專案結構（backend-go/）
- [x] 實作資料庫模型（Device, ClientPlan, Session, Transcript, Translation, Diagnostic）
- [x] 設定 GORM AutoMigrate
- [x] 實作 ASR 服務（OpenAI Whisper）
- [x] 實作翻譯服務（GPT-4o-mini + 語言偵測）
- [x] 實作 TTS 服務（OpenAI TTS-1）
- [x] 實作 REST API（POST /api/v1/asr/segment）
- [x] 實作 WebSocket API（GET /ws/asr/stream）
- [x] 實作中介軟體（CORS, RequestID, Logger）
- [x] 實作診斷系統（延遲追蹤）
- [x] 編譯測試（server 成功啟動在 port 8080）

## 翻譯功能問題修復（緊急）
- [x] 加入詳細時間戳記日誌（收到音訊時間、翻譯完成時間）
- [x] 加入每個處理步驟的時間記錄（Whisper、翻譯、總時間）
- [ ] 診斷翻譯不出來的原因（檢查伺服器日誌）
- [ ] 檢查 API 呼叫是否正常
- [ ] 檢查錯誤處理邏輯
- [ ] 修復翻譯功能
- [ ] 診斷速度慢的原因
- [ ] 優化處理流程
- [ ] 測試修復結果

## 手機版佈局優化
- [x] 調整手機版字幕順序（台灣人在下方，外國人在上方）
- [x] 使用 flex-col-reverse 實現手機版順序反轉
- [ ] 測試手機版顯示效果
