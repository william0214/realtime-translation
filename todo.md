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

- [x] 測試報告（TEST_REPORT.md）
- [x] 版本歷史（VERSION_HISTORY.md）
- [x] 測試程序（TESTING_PROCEDURE.md）
- [x] 開發時程（DEVELOPMENT_SCHEDULE.md）
- [x] 待辦事項（todo.md）
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
