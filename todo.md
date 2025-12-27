# 專案待辦事項

**專案：** 即時雙向翻譯系統（護理推車）  
**當前版本：** v1.3.5  
**最後更新：** 2025-12-25

---

## 🔥 緊急修復（立即處理）

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

#### 實作 shouldRunQualityPass() 成本控制機制
- [ ] 建立醫療關鍵詞字典（痛、發燒、血壓、藥、過敏、劑量等）
- [ ] 實作長度檢查（中文 ≥ 12-15 字）
- [ ] 實作數字/單位檢測
- [ ] 實作否定句檢測（沒有、不、不是）
- [ ] 實作短句過濾（<5 字直接跳過）
- [ ] 整合到 processFinalTranscript 流程
- [ ] 記錄 shouldRunQualityPass() 觸發率

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
- [ ] 實作 confidence < 0.7 的「不確定」標記
- [ ] UI 顯示「不確定」狀態（不翻譯）
- [ ] 加入 log 記錄不確定的句子
- [ ] 測試不確定句子的處理流程

### P2 - demo 後優化（Medium）

#### UI 視覺回饋優化
- [ ] 設計 provisional → final 的視覺變化
- [ ] 加入 loading indicator（Quality Pass 處理中）
- [ ] 優化 failed_final 的視覺提示
- [ ] 測試視覺回饋的使用者體驗

#### 成本監控與分析
- [ ] 記錄 shouldRunQualityPass() 的觸發率
- [ ] 分析 Quality Pass 的成功率
- [ ] 優化關鍵詞字典（減少誤判）
- [ ] 建立成本監控儀表板

### 測試與驗收

#### 狀態機測試
- [ ] 測試 pending → provisional → final 流程
- [ ] 測試 pending → provisional → failed_final 流程
- [ ] 測試 Stop recording 後不更新 UI
- [ ] 測試對話結束後不更新 UI

#### Race Condition 測試
- [ ] 測試 conversationId 不一致時丟棄 Quality Pass 結果
- [ ] 測試 message 不存在時丟棄 Quality Pass 結果
- [ ] 測試 version 不一致時丟棄 Quality Pass 結果
- [ ] 測試延遲超過 20 秒時丟棄 Quality Pass 結果

#### UI bubble 測試
- [ ] 測試每句話只有一顆 bubble
- [ ] 測試 provisional → final 更新同一顆 bubble
- [ ] 測試 Quality Pass 失敗時保留 provisional

#### 成本控制測試
- [ ] 測試短句（<5 字）不執行 Quality Pass
- [ ] 測試醫療關鍵詞觸發 Quality Pass
- [ ] 測試數字/單位觸發 Quality Pass
- [ ] 測試否定句觸發 Quality Pass
- [ ] 測試長句（≥ 12 字）觸發 Quality Pass

### 文件與發布
- [ ] 建立 MEDICAL_COMPLIANCE_GUIDE.md（醫療產品合規性指南）
- [ ] 建立 COST_OPTIMIZATION.md（成本優化指南）
- [ ] 建立 RACE_CONDITION_PREVENTION.md（Race Condition 防護指南）
- [ ] 更新 README.md（v2.1.0 功能說明）
- [ ] 建立 CHANGELOG-v2.1.md
- [ ] 建立 checkpoint (v2.1.0)

### 驗收標準（Acceptance Criteria）
- [ ] 短句（<5 字）不執行 Quality Pass，成本節省 > 30%
- [ ] 對話結束後，延遲的 Quality Pass 結果不更新 UI
- [ ] 每句話只有一顆 bubble，不產生重複訊息
- [ ] 醫療術語翻譯一致（Fast Pass 和 Quality Pass 使用相同術語）
- [ ] Whisper confidence < 0.7 時標記為「不確定」，不翻譯
- [ ] 所有 Race Condition 測試通過
- [ ] 所有狀態機測試通過
- [ ] 所有 UI bubble 測試通過
- [ ] 所有成本控制測試通過


---

## ✅ v2.1.0 - Phase 4 完成（UI 狀態顯示系統）

- [x] 整合 shouldRunQualityPass() 成本控制機制到 Quality Pass 觸發邏輯
- [x] 實作 qualityPassStatus: "skipped" 狀態（短句不執行 Quality Pass）
- [x] 短句直接標記為 final（translationStage: "final"）
- [x] 短句直接儲存到資料庫（使用 Fast Pass 翻譯）
- [x] 實作 UI 狀態顯示（provisional / final / skipped / failed）
- [x] 確保不產生第二顆 bubble（移除 finalMessage 中間狀態）
- [x] 實作完整狀態機約束（pending → provisional → final / failed_final）

**成果**：
- ✅ 成本控制機制已整合到翻譯流程
- ✅ 短句（如「好」、「謝謝」）不執行 Quality Pass
- ✅ 預期成本節省 30-50%
- ✅ 所有 TypeScript 錯誤已修正
- ✅ 建立 TranslationStatusBadge 組件（支援 5 種狀態顯示）
- ✅ 修正 bubble 產生邏輯（移除 finalMessage，確保每句話只有一顆 bubble）
- ✅ 驗證狀態機約束（pending → provisional → final / failed）

## 文件檢查器升級 v0 → v1（已完成，2025-12-27）

- [x] 補齊 shared/config.ts allowlist（4 個有效模型）
  - [x] gpt-4o-audio-preview（audio/realtime 類）
  - [x] gpt-4o-mini-transcribe（ASR）
  - [x] gpt-4.1-mini（translation default）
  - [x] gpt-4o-mini（translation option）
- [x] 修正 docs/realtime-subtitle-translation-spec.md default model（gpt-4o-mini → gpt-4.1-mini）
- [x] 升級 scripts/doc-check/check-models.ts 排除誤判
  - [x] 排除 code block 內容（```...```）
  - [x] 排除 error report 內容（❌ docs/...）
  - [x] 排除 diagnostics 內容（Documentation Consistency Check Report）
- [x] 驗證並推送到 GitHub
