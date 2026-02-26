# 專案待辦事項

**專案：** 即時雙向翻譯系統(護理推車)  
**當前版本：** v1.3.5  
**最後更新：** 2025-12-27

---

## 🔥 緊急修復（立即處理）

### VAD Speech END 後 Audio Pipeline 未立即停止問題（2025-12-27 新增）

#### 問題描述
- VAD 已正確偵測到 Speech END（RMS < endThreshold 連續 endFrames）
- 但 audio pipeline 沒有在 END 時立即停止
- segment 繼續接收音訊和 partial ASR 請求
- 最終由 auto-cut 超時機制觸發 finalize（而非 VAD END）
- 導致 finalize 延遲，使用者體驗不佳

#### 根本原因
- checkAudioLevel 偵測到 END 後，只設定 isSpeakingRef.current = false
- 但 partial chunk interval（每 300ms）仍持續執行
- sentenceBufferRef 仍持續累積新的 audio buffer
- 沒有機制阻止 END 後的 audio 進入 pipeline

#### 修復方案
1. **首次 Speech END 時立即 freeze audio pipeline**
   - 設定 segment.audioFrozen = true flag
   - 停止 sentenceBufferRef 累積新音訊
   - 取消 partial chunk interval
   - 立即觸發 processFinalTranscript

2. **防止重複 END 事件**
   - 加入 segment.endTriggered flag
   - 首次 END 後設定為 true
   - 後續 END 事件直接 return

3. **確保 finalize 由 VAD END 觸發**
   - Speech END 時立即呼叫 processFinalTranscript
   - auto-cut 只作為保底機制（超過 maxSegmentMs）
   - Console log 清楚區分 "Speech END finalize" vs "auto-cut finalize"

#### 實作清單
- [x] 在 Segment refs 中加入 audioFrozenSegmentsRef 和 endTriggeredSegmentsRef
- [x] checkAudioLevel 偵測 END 時設定 audioFrozen = true
- [x] checkAudioLevel 偵測 END 時設定 endTriggered = true
- [x] checkAudioLevel 偵測 END 時立即呼叫 processFinalTranscript
- [x] 修改 audio buffer 累積邏輯，檢查 audioFrozen flag
- [x] 修改 partial chunk interval，檢查 audioFrozen flag
- [x] 防止重複 END 事件（檢查 endTriggered flag）
- [x] 更新 Console log 區分 VAD END vs auto-cut
- [x] 在 stopRecording 時清理 frozen/end flags

#### 預期效果
- Speech END 後立即停止接收新音訊
- Speech END 後立即觸發 final transcript
- Console log 顯示 "Speech END finalize" 而非 "auto-cut finalize"
- finalize 延遲從 8-10 秒降至 0.4-0.6 秒
- auto-cut 只在極端情況下觸發（語音持續超過 maxSegmentMs）

#### 驗收標準
- [ ] Console log 顯示 "🟢 Speech END detected, freezing audio pipeline"
- [ ] Console log 顯示 "Speech END finalize" 而非 "auto-cut finalize"
- [ ] 短句（1-2 秒）在停止說話後 0.4-0.6 秒內 finalize
- [ ] 不會出現重複 END 事件的 log
- [ ] sentenceBufferRef 在 END 後不再增長

---

## ✅ 模型清理任務（2025-12-27 完成）

- [x] 全面移除 gpt-4o-realtime-preview 模型引用
  - [x] 搜尋所有包含 gpt-4o-realtime-preview 的檔案
  - [x] 從 docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md 移除範例引用
  - [x] 刪除 MODEL_CONSISTENCY_FIX_REPORT.md 歷史報告
  - [x] 更新 doc-check-report.md 移除相關錯誤項目
  - [x] 執行測試確認無破壞性變更
  - [x] 提交並推送到 GitHub

---

## 🔥 緊急修復（立即處理）

### VAD Speech END 參數優化（2025-12-27 新增）

#### 問題描述
- [ ] 當前 endThreshold (0.035) 和 endFrames (8) 偏保守
- [ ] 短句在語音停止後延遲過久才 finalize
- [ ] 實務上多數句子由 auto-cut 收尾而非正常 Speech END
- [ ] 需要降低 endThreshold 和 endFrames 加速 Speech END 檢測

#### 調整方案
- [x] startThreshold: 0.045（維持不變）
- [x] endThreshold: 0.035 → **0.028**（降低 20%）
- [x] endFrames: 8 → **4**（減半）
- [x] 保留 auto-cut 作為超時保險機制
- [x] Precise 模式同步優化（endThreshold: 0.032, endFrames: 5）

#### 預期效果
- [ ] 短句能在語音停止後 ~400ms 內快速 finalize（4 frames × 100ms）
- [ ] 減少依賴 auto-cut 的情況
- [ ] 改善使用者體驗（更快看到翻譯結果）

#### 驗收標準
- [x] 單元測試驗證所有 VAD 參數調整正確（20 個測試全部通過）
- [ ] 實際測試：說 1-2 秒短句後停止，觀察是否在 0.4-0.6 秒內觸發 final
- [ ] Console log 顯示 "Speech END detected" 而非 "auto-cut triggered"
- [ ] 不會因為過於靈敏而誤切長句

### Final Segment 翻譯結果無法顯示問題（2025-12-27 新增）

#### 問題描述
- [x] Final segment 在 stopRecording 時被取消，導致翻譯結果無法顯示
- [x] 翻譯只在 final segment 觸發，但 cleanup 時 segment 被標記為 cancelled
- [x] 需要保護已產生 final transcript 的 message，避免被 cleanup 清除

#### 修復方案
- [x] 在 ConversationMessage 加入 `finalized: boolean` 欄位
- [x] 在 processFinalTranscript 產生 final transcript 後，標記該 message 為 finalized
- [x] 修改 stopRecording cleanup 邏輯：
  - [x] 保留 finalized message（已產生 final transcript）
  - [x] 只清理 partial-only segment（未產生 final transcript）
- [x] 確保翻譯泡泡能正常顯示於 UI
- [x] 修正 hallucination 檢測邏輯，避免誤刪 finalized message

#### 驗收標準
- [ ] 點擊「結束對話」後，已產生的翻譯泡泡仍然顯示
- [ ] Console log 不再出現 segment cancelled 導致翻譯失敗的錯誤
- [ ] 只有 partial-only message 被清除，finalized message 保留

### VAD/ASR 系統修復（2025-12-25 新增）

#### 核心問題
- [x] 修正 Partial 常被判定太短（buffers < 10），導致字幕不穩定
- [x] 修正 Speech 太短被丟棄後，async 回來仍想更新 UI 的競態條件
- [x] 修正 Final chunk 長度超出設計上限（> 2.0s）
- [x] 修正 ASR 產生非轉錄性句子污染字幕（如 "Speaker likely speaks..."）
- [x] 修正 VAD threshold 在臨界值抖動（RMS 0.053~0.056, threshold 0.055）

#### 必做修改（核心設計）
- [x] 1) 引入 Segment 機制（segmentId / requestId guard）
  - [x] 每次 speech start 建立 segmentId（自增或 uuid）
  - [x] Partial message 綁定 segmentId
  - [x] Async response 回來前檢查 segmentId 是否仍為 active
  - [x] Speech too short 或 stopRecording 時設為 cancelled
  - [x] Async 回來若 segment cancelled → ignore（不更新 UI、不觸發翻譯）

- [x] 2) Partial 與 Final 音訊資料路徑分離
  - [x] Partial：固定滑動窗口（最後 1.0–1.5s）做即時字幕
  - [x] Final：句子結束時送出累積音訊，但送前必須 hard-trim
  - [x] Partial 不改動 final 的 buffer state
  - [x] Final 不復用 partial 的 window buffer

- [x] 3) 用「時間」取代「 buffer 數」當門檻
  - [x] minPartialDurationMs：400–600ms（低於就不送 partial）
  - [x] minFinalDurationMs：800–1000ms（低於就視為噪音）

- [x] 4) VAD 加入 hysteresis（雙門檻）與連續幀數判定
  - [x] startThreshold：0.060（連續 >= 3–5 幀才算 start）
  - [x] endThreshold：0.045（連續 >= 6–10 幀低於才算 end）

- [x] 5) Final hard-trim 強制保證 ≤ maxFinalSec（2.0s）
  - [x] 若 finalDuration > maxFinalSec：只取最後 maxFinalSec

- [x] 6) 後端/前端加入 ASR 輸出清洗
  - [x] 過濾包含 "Speaker likely speaks"、"The speaker is"、"This audio" 的輸出
  - [x] 過濾很短但包含多語名詞（Chinese/Vietnamese/English/Indonesian）的輸出

#### 建議改良（高價值）
- [x] 7) Partial 節流（throttle）
  - [x] 限制 partial 最多每 250–350ms 送一次
  - [x] 若文字無變化不更新 UI

- [x] 8) stopRecording 時一致性清理
  - [x] Cancel 當前 active segment
  - [x] Abort 所有 pending partial/final 的 fetch（用 AbortController）
  - [x] 清理 partial message list

#### 驗收標準
- [ ] 連續講 10 句：partial 更新不抖動，final 每句都出現且不重覆
- [ ] 快速短音（<800ms）：會被丟棄且不再出現 UI 更新錯誤
- [ ] 長句 >4s：會 auto-cut，且 final 每段 duration 符合上限
- [ ] Console 中 "No partial message to update" 近乎消失
- [ ] 不再出現 "Speaker likely speaks..." 被當成 transcript 顯示或送翻譯

---

## ✅ 已完成

### v1.3.5 (2025-12-25)
- [x] 加入所有 4 個 OpenAI ASR 模型支援
- [x] 在設定頁面顯示所有 4 個 ASR 模型選項
- [x] 加入前後端 Console Debug 日誌
- [x] 修復 502 錯誤（translationModel 驗證）

### v1.3.0 (2025-12-15)
- [x] iPhone 風格 UI 改進
- [x] 合併原文和翻譯到同一個泡泡
- [x] 對話泡泡樣式設計
- [x] 調整顏色方案

### v1.2.0 (2025-12-15)
- [x] 加入反向顯示開關功能（透明螢幕支援）

### v1.1.1 (2025-12-15)
- [x] 修復 UI 對話框顯示邏輯錯誤

### v1.1.0 (2025-12-15)
- [x] 修復即時字幕在結束對話時不消失的問題
- [x] 建立測試報告、版本歷史、測試程序、開發時程

### v1.0.0 (2025-12-14)
- [x] 即時雙向翻譯功能
- [x] 支援 8 種外語翻譯
- [x] 語音識別（Whisper ASR）
- [x] 語音合成（TTS）
- [x] 語音活動檢測（VAD）
- [x] 對話記錄管理
- [x] 歷史記錄查詢
- [x] 效能監控系統
- [x] 多後端支援（Node.js, Go, Hybrid）

---

## 📋 v1.5.4 - VAD 設定 UI 移除（完成，2025-12-25）

### 架構收斂目標
- [x] 移除所有 VAD 相關設定 UI
- [x] 移除所有 localStorage VAD 覆寫機制
- [x] VAD 參數唯一來源：shared/config.ts → ASR_MODE_CONFIG
- [x] 切換 ASR mode 為唯一合法的 VAD 行為切換方式

### Settings.tsx 清理
- [x] 移除所有 VAD 相關 state（rmsThreshold, silenceDuration, minSpeechDuration, vadStartThreshold, vadEndThreshold, vadStartFrames, vadEndFrames）
- [x] 移除所有 VAD 相關 UI（Slider, Label, Card）
- [x] 移除所有 localStorage.setItem("vad-*")
- [x] 移除所有 localStorage.getItem("vad-*")
- [x] 移除 handleResetToDefaults 中的 VAD 重置邏輯
- [x] 加入 VAD 參數說明卡片，引導使用者切換 ASR 模式

### Home.tsx 清理
- [x] 移除所有 localStorage VAD override 讀取邏輯
- [x] 確保 VAD 參數只從 getASRModeConfig(asrMode) 讀取
- [x] 移除任何 IIFE / fallback 邏輯讀取 localStorage

### Config 層改進
- [x] 在 ASR_MODE_CONFIG 明確定義 vadStartThreshold
- [x] 在 ASR_MODE_CONFIG 明確定義 vadEndThreshold
- [x] 在 ASR_MODE_CONFIG 明確定義 vadStartFrames
- [x] 在 ASR_MODE_CONFIG 明確定義 vadEndFrames
- [x] 移除 runtime 推導 magic number

### 測試與驗證
- [x] 執行單元測試驗證 VAD 行為（101/118 通過，Segmenter 測試全部通過）
- [x] 確認切換 ASR mode 會改變 VAD 行為（由 config 控制）
- [x] 確認 localStorage 舊值不影響行為（已移除所有讀取）
- [ ] 手動測試 normal 模式 VAD 行為（建議使用者測試）
- [ ] 手動測試 precise 模式 VAD 行為（建議使用者測試）

### 文件與發布
- [x] 更新 todo.md
- [x] 建立 checkpoint (v7201f084)
- [x] 建立 CHANGELOG-v1.5.4.md

---

## 📋 v1.5.3 - VAD/Segmenter 改進（完成，2025-12-25）

### Buffer 時間單位與日誌
- [x] 加入 buffer 時間單位 log（samples、ms），釐清「8 buffers ≈ 1.5s」的來源
- [x] 在 Console 顯示每個 buffer 的實際時長（ms）
- [x] 計算並顯示累積音訊總時長

### 狀態機修正
- [x] 修正狀態機：END detected 且 minSpeechMs 達標時立刻 final
- [x] END 後停止累積 buffer（不再接收新音訊）
- [x] 調整 auto-cut 邏輯：只作為超時保底，不干擾正常 END finalize

### VAD Hysteresis 調整
- [x] 調整 VAD hysteresis 預設值：
  - startThreshold: 0.06 → 0.045
  - endThreshold: 0.045 → 0.035
  - startConsecutive: 3 → 2
- [x] 在 Home.tsx 更新預設值
- [x] 在設定頁面加入 VAD hysteresis 參數控制（startThreshold, endThreshold, startConsecutive, endConsecutive）

### Async Response Guard
- [x] 統一 async response guard：segment cancelled / stopRecording 後任何 response 不可新增訊息
- [x] 在 processPartialChunk 加入 segment 檢查（已存在）
- [x] 在 processFinalTranscript 加入 segment 檢查（新增翻譯回應檢查）
- [x] 在翻譯回應處理加入 segment 檢查

### 單元測試
- [x] 補充 vitest 單測：END finalize 案例
- [x] 補充 vitest 單測：auto-cut 案例
- [x] 補充 vitest 單測：cancel guard 案例
- [x] 執行測試驗證所有功能正常（10/10 測試通過）

### 測試與發布
- [ ] 手動測試所有修改功能
- [ ] 更新測試報告
- [ ] 建立 checkpoint
- [ ] 推送到 GitHub

---

## 📋 v1.4.0 - VAD/ASR 系統重構（預計 2025-12-26）

### 核心修復
- [ ] 實作 Segment 機制解決競態條件
- [ ] 實作雙門檻 VAD 降低抖動
- [ ] 實作音訊路徑分離（Partial/Final）
- [ ] 實作 ASR 輸出清洗
- [ ] 實作 Final chunk 強制長度限制

### 測試與發布
- [ ] 執行完整單元測試
- [ ] 手動測試所有驗收標準
- [ ] 更新測試報告
- [ ] 建立 checkpoint
- [ ] 部署到生產環境

---

## 🚀 v1.5.0 - 效能優化（預計 2025-12-30）

### 效能優化
- [ ] 使用 Whisper Streaming API
  - [ ] 研究 Whisper Streaming API 文件
  - [ ] 實作串流音訊處理
  - [ ] 整合到現有系統
  - [ ] 測試延遲改善（目標：降低 50%）

- [ ] 優化翻譯模型
  - [ ] 測試不同模型（gpt-3.5-turbo-instruct, gpt-4.1-mini）
  - [ ] 比較延遲和品質
  - [ ] 選擇最佳模型

- [ ] 實作音訊預處理
  - [ ] 降噪處理
  - [ ] 音訊壓縮
  - [ ] 靜音移除

### 功能擴充
- [ ] 支援更多語言
  - [ ] 西班牙語（es）
  - [ ] 法語（fr）
  - [ ] 德語（de）
  - [ ] 俄語（ru）

- [ ] 建立效能監控儀表板
  - [ ] 設計儀表板 UI
  - [ ] 實作即時效能監控
  - [ ] 顯示延遲圖表
  - [ ] 顯示瓶頸分析

### 測試
- [ ] 建立前端 E2E 測試
  - [ ] 安裝 Playwright 或 Cypress
  - [ ] 撰寫基本翻譯流程測試
  - [ ] 撰寫 UI 互動測試

---

## 🎨 v2.0.0 - 進階功能（預計 2026-01-01）

### 多人對話支援
- [ ] 設計多人對話架構
- [ ] 支援 3+ 人同時對話
- [ ] 自動識別說話者
- [ ] 分別顯示每個人的對話

### 語音情緒分析
- [ ] 整合情緒分析 API
- [ ] 分析語音情緒（開心、悲傷、生氣、中性）
- [ ] 在 UI 顯示情緒標籤
- [ ] 記錄情緒到資料庫

### 對話摘要自動生成
- [ ] 修復對話摘要功能
- [ ] 實作自動摘要生成
- [ ] 對話結束後自動生成摘要
- [ ] 提取關鍵要點
- [ ] 顯示在歷史記錄中

### 對話記錄搜尋
- [ ] 實作全文搜尋
- [ ] 搜尋原文和譯文
- [ ] 支援日期範圍篩選
- [ ] 支援語言篩選
- [ ] 支援關鍵字高亮

---

## 🐛 已知問題

### 高優先級
1. **VAD/ASR 系統問題**（2025-12-25 新增）
   - Partial 常被判定太短，字幕不穩定
   - Speech 太短被丟棄後，async 回來仍想更新 UI
   - Final chunk 長度超出設計上限
   - ASR 產生非轉錄性句子污染字幕
   - VAD threshold 在臨界值抖動
   - 計劃：v1.4.0 完整重構

### 中優先級
2. **ASR 延遲過高**
   - 當前：2.5-3.5 秒
   - 目標：< 1.5 秒
   - 影響：翻譯延遲 > 3 秒
   - 計劃：v1.5.0 使用 Whisper Streaming API

---

## 📝 文件待辦

- [x] 測試報告(TEST_REPORT.md)
- [x] 版本歷史(VERSION_HISTORY.md)
- [x] 測試程序(TESTING_PROCEDURE.md)
- [x] 開發時程(DEVELOPMENT_SCHEDULE.md)
- [x] 待辦事項(todo.md)
- [x] Manus AI System Prompt 工程文件(docs/ai/ManusAI_SystemPrompt_Engineering.md)
- [ ] API 文件
- [ ] 使用者手冊
- [ ] 部署指南
- [ ] 故障排除指南

---

## 🧪 測試待辦

### 單元測試
- [x] 認證測試
- [x] 語音識別測試
- [x] 多語言翻譯測試
- [x] 語音合成測試
- [x] 對話管理測試
- [x] 歷史記錄測試
- [x] 效能測試
- [x] WebM 串流測試
- [x] 翻譯模型切換測試

### 整合測試
- [x] 對話整合測試
- [x] OpenAI 整合測試
- [ ] 前端 E2E 測試（待建立）

### 手動測試
- [ ] VAD/ASR 系統修復驗證（v1.4.0）
- [ ] VAD 語音活動檢測
- [ ] 多語言翻譯準確性
- [ ] UI 互動流程
- [ ] 錯誤處理

---

## 📊 效能優化待辦

### 當前效能指標
- ASR 延遲：2.5-3.5 秒
- 翻譯延遲：0.8-1.3 秒
- TTS 延遲：< 1 秒
- E2E 延遲：3.9 秒

### 目標效能指標（v1.5.0）
- ASR 延遲：1.0-1.5 秒（-50%）
- 翻譯延遲：0.5-0.8 秒（-30%）
- TTS 延遲：< 0.5 秒（-50%）
- E2E 延遲：2.0 秒（-48%）

### 優化項目
- [ ] 使用 Whisper Streaming API
- [ ] 優化翻譯模型
- [ ] 實作音訊預處理
- [ ] 實作快取機制
- [ ] 優化資料庫查詢
- [ ] 實作 CDN 加速

---

## 🔐 安全性待辦

- [ ] 實作 API rate limiting
- [ ] 實作 CSRF 保護
- [ ] 實作 XSS 防護
- [ ] 實作 SQL injection 防護
- [ ] 實作音訊檔案大小限制
- [ ] 實作使用者權限管理
- [ ] 實作敏感資料加密

---

## 📱 UI/UX 改善待辦

- [ ] 加入載入動畫
- [ ] 加入錯誤提示動畫
- [ ] 優化行動裝置體驗
- [ ] 加入鍵盤快捷鍵
- [ ] 加入深色模式
- [ ] 加入無障礙功能（ARIA）
- [ ] 加入多語言 UI（i18n）

---

## 🛠️ 技術債務

- [ ] 重構 Home.tsx（檔案過大，> 1000 行）
- [ ] 分離 VAD 邏輯到獨立模組
- [ ] 分離音訊處理邏輯到獨立模組
- [ ] 統一錯誤處理機制
- [ ] 加入 TypeScript strict mode
- [ ] 移除未使用的程式碼
- [ ] 優化 bundle size

---

## 📚 學習與研究

- [ ] 研究 Whisper Streaming API
- [ ] 研究 WebRTC 技術
- [ ] 研究語音情緒分析技術
- [ ] 研究說話者識別技術
- [ ] 研究離線翻譯技術
- [ ] 研究模型微調技術

---

## 📖 文件架構改進（2025-01-27 新增）

### 抽象化 Realtime/Audio 模型引用
- [x] 將 docs/realtime-subtitle-translation-spec.md 改用抽象概念（Realtime Audio Model）
- [x] 將 docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md 範例改用通用模型名稱
- [x] 確保文件不寫死具體 realtime/audio 模型名稱
- [x] 檢查器只驗證 allowlist 中的具體模型 ID
- [x] 驗證文件檢查器邏輯正確性

---

## 📖 設計規格文件開發（2025-12-25 新增）

### 文件撰寫
- [x] 撰寫系統架構與技術棧說明
- [x] 建立狀態機圖（Mermaid 格式）
- [x] 整理 OpenAI Realtime API 參數表
- [x] 定義驗收 KPI 指標
- [x] 建立完整設計規格文件（docs/realtime-subtitle-translation-spec.md）

### GitHub 整合
- [x] 推送設計規格文件到 GitHub repo
- [x] 確保文件格式符合 Markdown 標準
- [x] 包含所有必要的圖表和表格

### 規格補強（v1.5.0, 2025-12-25）
- [x] 新增 3.4 節「Segment 執行期一致性規範」
- [x] 補強 Segment 狀態機（IDLE → SPEAKING → ENDING → FINALIZING → DONE）
- [x] 定義 Partial ASR in-flight lock 機制
- [x] 定義 Stale response 丟棄規則（partialSeq）
- [x] 定義 Final hard-trim 強制規則（所有路徑適用）
- [x] 新增執行期一致性檢查清單（20 項）

---

## 🚀 v2.0.0 - 醫護品質最優方案（進行中，2025-12-25）

### 目標
實作醫護雙向翻譯的「品質最優」方案（方案2）：
- 即時字幕/即時翻譯可用（Fast Pass）
- 句尾定稿以高品質回填修正（Quality Pass）
- 醫療情境：不能亂加資訊、不能漏數字/單位/否定詞、術語一致
- 移除 VAD 設定 UI（不讓使用者調 VAD），但保留程式內可調（config 或 env）

### A. 兩段式翻譯流程（Fast Pass + Quality Pass）
- [x] 新增 translationStage 欄位到 ConversationMessage（provisional/final）
- [x] 新增 qualityPassStatus 欄位（pending/processing/completed/failed/skipped）
- [x] 實作 Fast Pass 翻譯（gpt-4.1，快速顯示）
- [x] 實作 Quality Pass 翻譯（gpt-4o，醫療級定稿）
- [x] UI 回填更新機制（同一 bubble 從 provisional → final）
- [x] 後端支援 translationQuality 參數（fast/quality）
- [x] 新增 tRPC procedure：translation.qualityPass
- [x] 實作 Quality Pass 自動觸發機制（Fast Pass 完成後非阻塞執行）
- [x] **Phase 3: Race Condition 防護機制（v2.1.0）**
  - [x] 在 ConversationMessage 加入 version, conversationId, conversationKey, createdAt 欄位
  - [x] 建立 currentConversationKey (UUID) 和 currentConversationKeyRef
  - [x] 在 startRecording 時生成 conversationKey
  - [x] 在 stopRecording 時立即清空 conversationKey
  - [x] 在 Quality Pass 開始時 capture keyAtRequestTime, versionAtRequestTime, requestStartTime
  - [x] 在 Quality Pass 完成時檢查 shouldApplyQualityPassResult()
  - [x] 建立 shared/raceConditionGuard.ts 工具模組
  - [x] 所有 ConversationMessage 建立位置都加入必要欄位
- [x] **Phase 4: 移除 Quality Pass（v2.2.0）**
  - [x] 停用 Cost Control 的 Quality Pass 觸發機制（shouldRunQualityPass 一律回傳 false）
  - [x] 簡化 ConversationMessage interface（移除 translationStage, qualityPassStatus, version, conversationKey, createdAt）
  - [x] 移除 qualityPassMutation
  - [x] 簡化 processFinalTranscript（只保留 Fast Pass）
  - [x] 移除 UI 中的 TranslationStatusBadge 組件
  - [x] 移除 Race Condition 防護相關程式碼
  - [x] 調整 VAD 段落切分參數（maxSegmentMs: normal 8000ms, precise 10000ms）
  - [x] 標記後端 qualityPass endpoint 為已棄用
  - [x] 標記 TranslationStatusBadge 組件為已棄用

### B. 上下文注入（Context）
- [ ] 實作對話 context 管理（最近 3-6 句）
- [ ] Context 包含 speaker role、sourceLang、targetLang、previous translations
- [ ] 實作 getConversationContext 函數
- [ ] Quality Pass 翻譯時自動注入 context
- [ ] 醫療專用 prompt 規則（忠實翻譯、數字單位保護、否定詞保護）
- [ ] 建立 Fast Pass prompt template
- [ ] 建立 Quality Pass prompt template（含 context）

### C. Glossary 術語一致性
- [ ] 建立醫療術語字典（shared/glossary.ts）
- [ ] 支援 zh→vi 術語對照（BP/血壓、HR/心跳、SpO2/血氧、體溫、止痛藥、過敏、糖尿病、高血壓、懷孕、哺乳）
- [ ] 支援其他語言 fallback
- [ ] Quality Pass 翻譯時強制使用 glossary
- [ ] 數字/單位保護機制（mg/ml/cc/℃/mmHg/天/週/次）
- [ ] 實作 applyGlossary 函數
- [ ] 實作 protectNumbers 函數

### D. Quality Gate 守門機制
- [ ] 實作翻譯品質檢查函數（detectTranslationIssues）
- [ ] 檢查規則：數字遺漏檢測
- [ ] 檢查規則：否定詞反轉檢測
- [ ] 檢查規則：長度異常檢測
- [ ] Gate fail 時自動觸發 Quality Pass 重跑
- [ ] 加入詳細的 quality gate log
- [ ] 實作 Quality Gate 統計（pass/fail 比例）

### E. 分段策略調整
- [ ] 保留完整 transcript 文字（不只最後 2 秒）
- [ ] 修改 final chunk 處理邏輯（文字層完整保留）
- [ ] 避免硬 trim 導致翻譯缺前文
- [ ] 考慮多段 ASR → 文字合併 → 翻譯策略
- [ ] 實作 transcript accumulation 機制
- [ ] 測試長句翻譯品質（> 4 秒）

### F. 移除 VAD 設定 UI（已在 v1.5.4 完成）
- [x] 從 Settings.tsx 移除所有 VAD 相關 UI
- [x] 清理 localStorage 舊 VAD 值
- [x] 確認 VAD 參數只從 config 讀取
- [x] 允許 env 覆寫 VAD 參數（但不提供 UI）

### 測試與驗收
- [ ] 測試 Fast Pass 翻譯速度（1-2 秒內顯示）
- [ ] 測試 Quality Pass 回填（3-6 秒內更新）
- [ ] 測試術語一致性（醫療術語正確翻譯）
- [ ] 測試數字單位保護（不遺漏、不錯誤）
- [ ] 測試否定詞保護（不反轉）
- [ ] 測試完整句子翻譯（不缺前文）
- [ ] 確認 Settings 頁面無 VAD UI
- [ ] 確認 localStorage 舊值不影響行為
- [ ] 測試 10 句連續對話（Fast Pass + Quality Pass）
- [ ] 測試醫療情境對話（用藥、疼痛、過敏等）

### 文件與發布
- [ ] 建立 ARCHITECTURE-v2.0.md（架構設計文件）
- [ ] 建立 MEDICAL_GLOSSARY.md（術語字典文件）
- [ ] 建立 QUALITY_GATE.md（品質守門機制文件）
- [ ] 建立 PROMPT_TEMPLATES.md（Fast Pass / Quality Pass prompt）
- [ ] 更新 README.md
- [ ] 建立 checkpoint (v2.0.0)

### 驗收標準（Acceptance Criteria）
- [ ] 使用者說一句中文（醫療問句），畫面 1–2 秒內先顯示 provisional 翻譯（gpt-4.1）
- [ ] 3–6 秒內同一 bubble 被回填為高品質 final 翻譯（gpt-4o），且術語一致、數字單位不丟
- [ ] 不再出現「只翻到後半句」的常見缺前文問題（至少在文字翻譯層面修正）
- [ ] Settings 頁面沒有任何 VAD UI，且舊 localStorage 不再影響 VAD 行為
- [ ] Quality Gate 檢測到問題時自動重跑 Quality Pass
- [ ] 醫療術語翻譯一致（BP→huyết áp, HR→nhịp tim, SpO2→oxy máu）
- [ ] 數字單位不遺漏（120/80 mmHg, 38.5℃, 500mg）
- [ ] 否定詞不反轉（不痛→không đau, 沒有過敏→không dị ứng）


---

## ✅ v2.0.0 已完成項目（2025-12-25）

### 前端整合實作（2025-12-25）
- [x] 更新 ConversationMessage 資料結構（新增 conversationContext 欄位）
- [x] 實作對話 context 管理（conversationContextRef, MAX_CONTEXT_SIZE = 6）
- [x] 整合 Quality Pass tRPC mutation（trpc.translate.qualityPass）
- [x] 實作兩段式翻譯流程（Fast Pass → Quality Pass）
- [x] 實作 UI 回填更新機制（setConversations 更新 translatedText）
- [x] 實作 Quality Pass 自動觸發（非阻塞 async 執行）
- [x] 實作 translationStage 狀態顯示（⏳ processing, ✅ final）
- [x] 建立兩段式翻譯單元測試（twoPassTranslation.test.ts, 6/6 通過）

## ✅ v2.0.0 已完成項目（2025-12-25）

### 核心架構實作
- [x] 建立 shared/glossary.ts（醫療術語字典）
- [x] 建立 shared/qualityGate.ts（品質守門機制）
- [x] 建立 shared/translationPrompts.ts（Prompt 模板）
- [x] 建立 server/twoPassTranslation.ts（兩段式翻譯服務）
- [x] 更新 server/routers.ts（新增 fastPass, qualityPass procedures）
- [x] 更新 client/src/pages/Home.tsx（ConversationMessage 資料結構）

### 文件建立
- [x] 建立 docs/ARCHITECTURE-v2.0.md（架構設計文件）
- [x] 建立 docs/MEDICAL_GLOSSARY.md（術語字典文件）
- [x] 建立 docs/QUALITY_GATE.md（品質守門機制文件）

### Glossary 術語字典
- [x] 支援 zh→vi 術語對照（47 個術語）
- [x] 生命徵象（8 個）：BP/血壓、HR/心跳、SpO2/血氧等
- [x] 症狀（10 個）：疼痛、噁心、頭暈等
- [x] 藥物（5 個）：止痛藥、抗生素等
- [x] 疾病狀況（6 個）：糖尿病、高血壓、過敏、懷孕、哺乳等
- [x] 醫療程序（4 個）：打針、抽血等
- [x] 身體部位（5 個）：頭、胸、腹等
- [x] 時間單位（5 個）：天、週、次等
- [x] 否定詞（4 個）：不、沒有、未、別等
- [x] 保護單位（mg/ml/cc/℃/mmHg/天/週/次等）

### Quality Gate 守門機制
- [x] 實作 6 種檢查規則
- [x] 空白翻譯檢測（Critical）
- [x] 相同文字檢測（High）
- [x] 數字遺漏檢測（Critical/High）
- [x] 否定詞反轉檢測（Critical）
- [x] 長度異常檢測（Medium）
- [x] 可疑內容檢測（Medium）
- [x] 品質分數計算（0-100，通過門檻 70）
- [x] 建議動作機制（accept/retry_fast/retry_quality）

### 兩段式翻譯流程
- [x] Fast Pass 翻譯（gpt-4.1）
- [x] Quality Pass 翻譯（gpt-4o）
- [x] 自動重試機制（最多 1 次）
- [x] Quality Gate 整合
- [x] tRPC procedures（translate.fastPass, translate.qualityPass）

### Prompt 模板
- [x] Fast Pass Prompt（簡潔明確，速度優先）
- [x] Quality Pass Prompt（含 context 和 glossary，品質優先）
- [x] Retry Prompt（明確指出上次翻譯的問題）
- [x] 醫療翻譯規則（忠實翻譯、數字單位保護、否定詞保護、術語一致性）

### 資料結構
- [x] ConversationMessage 新增 translationStage 欄位（provisional/final）
- [x] ConversationMessage 新增 qualityPassStatus 欄位（pending/processing/completed/failed）
- [x] ConversationMessage 新增 sourceLang, targetLang 欄位
- [x] ConversationContext 介面定義

## 🚧 v2.0.0 待完成項目

### 分段策略調整
- [ ] 保留完整 transcript 文字（不只最後 2 秒）
- [ ] 修改 final chunk 處理邏輯（文字層完整保留）
- [ ] 避免硬 trim 導致翻譯缺前文
- [ ] 考慮多段 ASR → 文字合併 → 翻譯策略

### 測試與驗收
- [ ] 測試 Fast Pass 翻譯速度（1-2 秒內顯示）
- [ ] 測試 Quality Pass 回填（3-6 秒內更新）
- [ ] 測試術語一致性（醫療術語正確翻譯）
- [ ] 測試數字單位保護（不遺漏、不錯誤）
- [ ] 測試否定詞保護（不反轉）
- [ ] 測試完整句子翻譯（不缺前文）
- [ ] 測試 10 句連續對話（Fast Pass + Quality Pass）
- [ ] 測試醫療情境對話（用藥、疼痛、過敏等）
- [ ] 測試 Quality Gate 檢測（數字遺漏、否定詞反轉、長度異常）
- [ ] 測試自動重試機制

### 單元測試
- [ ] glossary.ts 單元測試
- [ ] qualityGate.ts 單元測試
- [ ] translationPrompts.ts 單元測試
- [ ] twoPassTranslation.ts 單元測試

### 文件補充
- [ ] 建立 PROMPT_TEMPLATES.md（Fast Pass / Quality Pass prompt 範例）
- [ ] 更新 README.md（v2.0.0 功能說明）
- [ ] 建立 CHANGELOG-v2.0.md

### 發布
- [ ] 建立 checkpoint (v2.0.0)
- [ ] 推送到 GitHub


---

## 🏥 v2.1.0 - 醫療產品合規性改進（2025-12-25 新增）

### 診斷報告
- [x] 建立醫療產品合規性診斷報告（docs/MEDICAL_COMPLIANCE_AUDIT.md）
- [x] 識別 5 個嚴重問題（Critical/High）
- [x] 建立工程決策優先級（P0/P1/P2）

### P0 - 必須在 demo 前完成（Critical）

#### ✅ 實作 shouldRunQualityPass() 成本控制機制（2025-12-27 完成）
- [x] 建立醫療關鍵詞字典（痛、發燒、血壓、藥、過敏、劑量等）
- [x] 實作長度檢查（中文 ≥ 12 字）
- [x] 實作數字/單位檢測
- [x] 實作否定句檢測（沒有、不、不是）
- [x] 實作短句過濾（<3 字直接跳過）
- [x] 整合到 processFinalTranscript 流程
- [x] 建立完整單元測試（25/25 通過）

#### 強化 Race Condition 防護機制
- [ ] 在 ConversationMessage 加入 version 或 createdAt timestamp
- [ ] Quality Pass 回填前檢查 conversationId 是否一致
- [ ] Quality Pass 回填前檢查 message 是否仍存在
- [ ] Quality Pass 回填前檢查 version 是否一致
- [ ] 實作 15-20 秒超時檢查
- [ ] 加入 AbortController 取消機制
- [ ] 測試 Race Condition 情境（對話結束、訊息更新、延遲超時）

#### 修正 UI bubble 邏輯（不新增第二顆 bubble）
- [ ] 分析目前的 bubble 產生邏輯（line 809-824）
- [ ] 設計單一 bubble 更新方案（provisional → final）
- [ ] 修改 processFinalTranscript 不新增第二顆 bubble
- [ ] 確保 Quality Pass 只更新現有 bubble
- [ ] 測試 Fast Pass 失敗 + Quality Pass 成功的情境
- [ ] 測試 Fast Pass 成功 + Quality Pass 失敗的情境
- [ ] 測試 Fast Pass 成功 + Quality Pass 成功的情境

### P1 - demo 前建議完成（High）

#### 強制注入醫療術語字典到 Quality Pass
- [ ] 檢查 shared/glossary.ts 的術語完整性（目前 47 個）
- [ ] 在 Quality Pass prompt 中強制注入 glossary
- [ ] 測試術語一致性（Fast Pass vs Quality Pass）
- [ ] 記錄術語使用率（哪些術語最常被使用）

#### 實作「不確定」標記機制
- [ ] 檢查 Whisper API 是否回傳 confidence score
- [ ] 在 ConversationMessage 加入 confidence 欄位
- [ ] UI 顯示低信心度的訊息（< 0.7）
- [ ] 加入「不確定」標記（⚠️ 或 ? 圖示）
- [ ] 記錄低信心度訊息比例

### P2 - demo 後優化（Medium）

#### 實作 Quality Pass 效能監控
- [ ] 記錄 Quality Pass 執行時間
- [ ] 記錄 Quality Pass 成功/失敗率
- [ ] 記錄 Quality Gate 通過/失敗率
- [ ] 建立效能監控儀表板
- [ ] 設定 alert 機制（失敗率 > 10%）

#### 實作 Glossary 動態更新機制
- [ ] 設計 glossary 更新 API
- [ ] 實作 glossary 版本控制
- [ ] 實作 glossary 熱更新（不需重啟）
- [ ] 建立 glossary 管理 UI
- [ ] 記錄 glossary 使用統計

### 測試與驗收
- [ ] 測試 shouldRunQualityPass() 過濾效果
- [ ] 測試 Race Condition 防護（對話結束、訊息更新、延遲超時）
- [ ] 測試單一 bubble 更新（不新增第二顆）
- [ ] 測試術語強制注入（Quality Pass）
- [ ] 測試「不確定」標記顯示
- [ ] 測試效能監控儀表板
- [ ] 測試 Glossary 動態更新

### 文件與發布
- [ ] 建立 COST_CONTROL.md（成本控制機制文件）
- [ ] 建立 RACE_CONDITION_GUARD.md（競態條件防護文件）
- [ ] 建立 UI_BUBBLE_LOGIC.md（UI bubble 邏輯文件）
- [ ] 更新 ARCHITECTURE-v2.0.md
- [ ] 建立 checkpoint (v2.1.0)

### 驗收標準（Acceptance Criteria）
- [ ] shouldRunQualityPass() 觸發率 < 30%（短句、寒暄語被過濾）
- [ ] Race Condition 防護有效（對話結束後不再更新 UI）
- [ ] 單一 bubble 更新正常（不新增第二顆）
- [ ] 術語強制注入有效（Quality Pass 使用 glossary）
- [ ] 「不確定」標記正常顯示（低信心度訊息）
- [ ] 效能監控儀表板正常運作
- [ ] Glossary 動態更新正常運作

---

## 📝 備註

- 所有待辦事項按優先級排序
- 緊急修復項目優先處理
- 定期更新此文件以反映最新進度
- 每個版本完成後更新「已完成」區塊


---

## 🔄 v2.2.0 - 移除 Quality Pass，改採 Fast Pass only（2025-12-27）

### 背景
- Quality Pass 經常因 Race Condition 導致 "Message not found" 錯誤
- 根本原因：messageId 使用 array index（不穩定）
- 目前 maxSegmentMs=2000ms 過於激進，造成句子碎片化
- 決策：先把 Quality Pass 完全關掉，做一條穩定的 VAD-only baseline

### 目標
- 完全停用 Quality Pass（包含醫療關鍵字觸發）
- 段落切分由 VAD 控制（不再 2 秒硬切）
- 每個段落只做一次翻譯（Fast Pass only）
- 調整 maxSegmentMs ≥ 6000ms（避免碎句）

### 實作項目
- [ ] 在 shared/config.ts 加入 ENABLE_QUALITY_PASS feature flag（預設 false）
- [ ] 修改 shared/costControl.ts 的 shouldRunQualityPass() 一律回傳 false
- [ ] 移除前端 Quality Pass 觸發邏輯（Home.tsx）
- [ ] 移除前端 Quality Pass 回寫邏輯（applyQualityPassResult）
- [ ] 移除前端 Race Guard 對 Quality Pass 的處理
- [ ] 調整 ASR_MODE_CONFIG 的 maxSegmentMs（normal: 8000ms, precise: 10000ms）
- [ ] 移除 UI 的 Quality Pass 狀態顯示（processing/completed/failed）
- [ ] 簡化 ConversationMessage 狀態（只保留 partial/final）
- [ ] 更新單元測試（移除 Quality Pass 相關測試）

### 驗收標準
- [ ] Console log 不再出現 "Quality Pass Starting..."
- [ ] Console log 不再出現 "Message not found, discarding Quality Pass result"
- [ ] 同一句只觸發一次翻譯請求
- [ ] VAD 切段正常（Speech START/END）
- [ ] maxSegmentMs 可配置且預設 ≥ 6000ms
- [ ] 長句不再被 2 秒硬切（至少 6-10 秒）
- [ ] 翻譯品質提升（完整句子翻譯）

### 後續改進（v3.0.0+）
- [ ] messageId 全面 UUID 化（不使用 array index）
- [ ] messagesById（Map）取代 array index 查找
- [ ] race guard 粒度改為 per-message（messageId + version）
- [ ] 條件式恢復 Quality Pass（醫療關鍵句）

## ✅ VAD-only Segmentation 回退（2025-12-27 完成）

### 目標
將 pipeline 回退為 VAD-only segmentation：
- 移除 partial ASR 機制（即時字幕）
- 只在 Speech END 時使用 final transcript 進行翻譯
- Auto-cut 僅作為 safety net，不作為主要段落結束機制

### 需要移除的 Partial ASR 相關程式碼

#### 1. Partial Buffer 和 State
- [x] `partialBufferRef` (line 325)
- [x] `PARTIAL_WINDOW_DURATION_S` (line 326)
- [x] `partialMessageIdRef` (line 300)
- [x] `lastPartialTimeRef` (line 301)
- [x] `partialIntervalRef` (line 302)
- [x] `segmentToPartialMessageRef` (line 295)
- [x] `partialAbortControllersRef` (line 296)

#### 2. Partial Config 參數
- [x] `PARTIAL_CHUNK_INTERVAL_MS` (line 384)
- [x] `PARTIAL_CHUNK_MIN_DURATION_MS` (line 385)
- [x] `PARTIAL_CHUNK_MIN_BUFFERS` (line 386)

#### 3. Partial 處理函數
- [x] `processPartialChunk` 函數 (line 530-683)
- [x] Partial chunk interval 邏輯 (line 958-993)
- [x] Partial message 創建邏輯 (line 1032-1048)

#### 4. Partial UI 顯示
- [x] Nurse partial transcript UI (line 1780-1789)
- [x] Patient partial transcript UI (line 1833-1842)
- [x] `setPartialSubtitle` state (line 199)

#### 5. Partial Cleanup 邏輯
- [x] stopRecording 中的 partial cleanup (line 1575-1589)
- [x] stopHybridRecording 中的 partial cleanup (line 1400-1412)
- [x] Speech too short 時的 partial cleanup (line 1134-1139)
- [x] Final chunk too short 時的 partial cleanup (line 1230-1234)

#### 6. Partial Buffer 累積邏輯
- [x] Audio buffer 累積到 partialBufferRef (line 1481-1482)
- [x] Speech start 時清空 partialBufferRef (line 1020)
- [x] Speech end 時清空 partialBufferRef (line 1100, 1146, 1217, 1238, 1568)

### 保留的功能
- ✅ VAD Speech START/END detection
- ✅ Speech END 時立即 freeze audio pipeline
- ✅ Speech END 時立即觸發 final transcript
- ✅ Final transcript 翻譯（gpt-4.1-mini）
- ✅ Auto-cut 作為 safety net（maxSegmentMs）

### 預期效果
- ✅ 移除即時字幕功能
- ✅ 只在語音結束時顯示完整翻譯
- ✅ 簡化 pipeline，降低複雜度
- ✅ 減少 API 呼叫次數（只有 final transcript）
- ✅ 提高系統穩定性

### 驗收標準
- [x] 沒有 partial message 出現在 UI
- [ ] Console log 沒有 "[Partial]" 相關日誌（需要實際測試）
- [ ] Speech END 時立即觸發 final transcript（需要實際測試）
- [ ] Final transcript 正常翻譯並顯示（需要實際測試）
- [ ] Auto-cut 只在超過 maxSegmentMs 時觸發（需要實際測試）

### 實作摘要
- 移除了約 200+ 行 partial ASR 相關程式碼
- 簡化了 VAD monitoring 邏輯（移除 300ms partial chunk interval）
- processFinalTranscript 成為唯一的 ASR 觸發點
- UI 移除了黃色邊框的即時字幕區塊
- 保留了 Speech END freeze audio pipeline 機制

---

---

## ✅ 修復 Speech END 重複觸發 processFinalTranscript（2025-12-27 完成）

### 問題描述
從 Console log 發現 `processFinalTranscript` 被呼叫了兩次，導致產生兩個相同的翻譯泡泡。

### 根本原因
程式碼中有兩個地方會觸發 `processFinalTranscript`：
1. `checkAudioLevel` 中的 VAD Speech END 偵測（新機制）✅
2. `startVADMonitoring` 中的舊 Speech END 邏輯（應該移除）❌

### 修復方案
- [x] 移除 `startVADMonitoring` 中的舊 Speech END 邏輯（line ~840-945，共 105 行）
- [x] 只保留 `checkAudioLevel` 中的 VAD Speech END 觸發
- [x] 保留 auto-cut 超時保護機制（語音持續超過 maxSegmentMs）
- [x] 確保 `endTriggeredSegmentsRef` 防護機制正常運作

### 驗收標準
- [x] TypeScript 編譯無錯誤
- [x] 所有 VAD/Segmenter 測試通過（10/10）
- [x] 程式碼邏輯正確（移除重複觸發）
- [ ] 實際測試：Console log 只出現一次 "Triggering final transcript"
- [ ] 實際測試：每句話只產生一個翻譯泡泡
- [ ] 實際測試：Speech END 後立即 finalize（0.4-0.6 秒）

### 修復效果
- `processFinalTranscript` 現在只會被呼叫一次（由 VAD Speech END 觸發）
- 不會再產生重複的翻譯泡泡
- Console log 只會出現一次 "Triggering final transcript"
- Auto-cut 機制仍然保留作為超時保護


---

## 🎯 翻譯品質改善（2025-12-27 新增）

### Chunk 長度優化（避免零碎翻譯）

#### 問題描述
- 當前 chunk 切分過於頻繁，導致翻譯零碎
- 需要增加 chunk 長度，讓翻譯更完整、更流暢
- 目標：讓系統等待更長的語音段落後再進行翻譯

#### 調整方案（方案 B 激進調整）
- [x] 增加 VAD endThreshold (0.028 -> 0.055, 提高 100%)
- [x] 增加 VAD endFrames (4 -> 12, 三倍, 需要 1200ms 靜音才結束)
- [x] 增加 finalMaxDurationMs (8000ms -> 12000ms, 允許更長句子)
- [x] Normal 和 Precise 模式均已調整

#### 預期效果
- 翻譯更完整，不會被切成零碎片段
- 使用者體驗更好，翻譯更流暢
- 適合醫療場景的完整句子翻譯

#### 驗收標準
- [ ] 實際測試：說一句完整的話（5-8 秒），確認不會被切成多段
- [ ] 翻譯結果是完整的句子，而非零碎片段
- [ ] Console log 顯示 chunk 長度增加

---

## 🐛 語言選擇功能問題（2025-12-27 新增）

### 問題描述
- 使用者在 UI 選擇「英文」作為目標語言
- 系統仍然翻譯成越南文，忽略使用者的選擇
- 語言選擇器顯示正確，但實際翻譯時未使用選擇的語言

### 診斷步驟
- [x] 檢查前端語言選擇器的 state 管理
- [x] 檢查翻譯 API 呼叫時是否正確傳遞 targetLanguage
- [x] 檢查後端 determineDirection 函數的語言判斷邏輯
- [x] 檢查是否有預設語言覆蓋使用者選擇

### 修復方案
- [x] 確保前端正確傳遞 preferredTargetLang 參數
- [x] 修正後端語言判斷邏輯，優先使用使用者選擇
- [x] 移除不必要的預設語言 fallback

### 修復詳情
- [x] Rule 1 (越南文偵測): targetLang 從硬編碼 "zh" 改為 preferredTargetLang || "zh"
- [x] Rule 4 (非中文語言): targetLang 從硬編碼 "zh" 改為 preferredTargetLang || "zh"
- [x] 建立 13 個單元測試驗證修復

### 驗收標準
- [x] 選擇英文後，翻譯結果為英文 (13/13 測試通過)
- [x] 選擇越南文後，翻譯結果為越南文 (13/13 測試通過)
- [x] Console log 顯示正確的 targetLang 參數 (已加入 log)

---

## 🐛 語言切換問題（2025-12-27 新增）

### 問題描述
- 使用者在對話過程中從越南文切換成英文
- 系統仍然翻譯成越南文，沒有使用新選擇的語言
- 後端已修復 determineDirection 函數，但前端可能沒有正確傳遞新的語言參數

### 診斷步驟
- [ ] 檢查前端 targetLanguage state 是否正確更新
- [ ] 檢查 autoTranslate API 呼叫時是否使用最新的 targetLanguage
- [ ] 檢查是否有快取或閉包問題導致使用舊的語言值

### 修復方案
- [ ] 確保 targetLanguage state 更新後立即生效
- [ ] 確保 API 呼叫使用最新的 targetLanguage 值
- [ ] 加入 debug log 顯示實際傳遞的語言參數

### 驗收標準
- [ ] 切換語言後，下一句翻譯使用新的語言
- [ ] Console log 顯示正確的 targetLanguage 參數
- [ ] 不需要重新開始對話就能切換語言

### 新增需求（使用者回饋）
- [x] 結束對話時清除對話記錄
- [x] 開始對話時重新讀取前端選擇的語系
- [x] 確保每次開始新對話都使用最新的語言設定

### 實施詳情
- [x] stopRecording: 加入 setConversations([]) 清除對話記錄
- [x] stopRecording: 加入 messageIdRef.current = 0 重置訊息 ID
- [x] startRecording: 已經正確使用 targetLanguage 參數
- [x] 加入 debug log 顯示開始錄音時使用的語言
- [x] 加入 debug log 追蹤 targetLanguage 變化
- [x] 加入 debug log 顯示 API 呼叫時的 targetLanguage

---

## 🚨 緊急問題（2025-12-27）

### 問題描述
- 前端介面選擇英文後，仍然翻譯成越南文
- 使用者已測試確認問題存在
- 需要立即檢查並修復

### 診斷步驟
- [ ] 檢查語言選擇器的選項值是否正確
- [ ] 檢查 Console log 顯示的實際 targetLanguage 值
- [ ] 檢查後端收到的 preferredTargetLang 參數

### 可能原因
- [ ] 語言選擇器的 value 設定錯誤
- [ ] 前端 state 沒有正確更新
- [ ] API 呼叫時參數傳遞錯誤

### 問題根源（已確認）
- [x] 前端選擇器正確顯示「英文」
- [x] targetLanguage state 正確更新為 "en"
- [x] processSentenceForTranslationRef 多次更新
- [x] **但 processFinalTranscript 使用的是閉包中的舊值 "vi"**

### 解決方案
- [x] 使用 useRef 儲存 targetLanguage，確保總是使用最新值
- [x] 在 processFinalTranscript 中從 ref 讀取 targetLanguage
- [x] 修復 Node.js backend 呼叫
- [x] 修復 Go backend 呼叫
- [x] 修復 saveTranslation 呼叫

### 實施詳情
- [x] 加入 targetLanguageRef = useRef<string>("vi")
- [x] 加入 useEffect 同步 targetLanguage 到 ref
- [x] 在 processFinalTranscript 中使用 targetLanguageRef.current
- [x] TypeScript 編譯無錯誤

---

## 🎯 模型品質提升（2025-12-27）

### 目標
- 提升預設翻譯模型品質
- 提升預設 ASR 模型品質
- 改善翻譯準確度和語音辨識準確度

### 當前配置
- [x] 檢查當前翻譯模型預設值 (gpt-4.1-mini)
- [x] 檢查當前 ASR 模型預設值 (gpt-4o-mini-transcribe)
- [x] 檢查當前 ASR 模式預設值 (normal)

### 優化方案
- [x] 翻譯模型：從 gpt-4.1-mini 升級到 gpt-4o（最高品質）
- [x] ASR 模型：從 gpt-4o-mini-transcribe 升級到 gpt-4o-transcribe（高品質）
- [ ] ASR 模式：保持 normal（用戶可在設定頁面切換到 precise）

### 實施詳情
- [x] shared/config.ts: TRANSLATION_CONFIG.LLM_MODEL = "gpt-4o"
- [x] shared/config.ts: WHISPER_CONFIG.MODEL = "gpt-4o-transcribe"
- [x] 更新註釋標示推薦模型

---

## 🎨 UI 精簡化（2025-12-27）

### 目標
- 移除前端顯示的開發語言標籤 (Node.js)

### 任務
- [x] 找到顯示 "(Node.js)" 的位置 (client/src/pages/Home.tsx:1272-1274)
- [x] 移除該顯示元素
- [ ] 測試驗證 UI 顯示正確

### 實施詳情
- [x] 移除 Home.tsx 中的 backend 顯示標籤
- [x] 保留 Hybrid 後端的連接狀態顯示
