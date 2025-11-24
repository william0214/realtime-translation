# 護理推車即時雙向翻譯系統 - 任務清單

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
- [x] 測試語音識別功能
