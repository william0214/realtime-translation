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
