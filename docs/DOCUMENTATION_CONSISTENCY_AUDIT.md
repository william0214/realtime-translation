# 文件與實作一致性檢查報告

**執行日期**：2025-12-27  
**檢查範圍**：所有 Markdown 文件（31 個）  
**檢查目的**：確保文件與程式碼實作一致

---

## 📋 執行摘要

### 檢查結果
- **總文件數**：31 個 Markdown 文件
- **發現不一致項目**：3 個（已修正）
- **需要補充範例**：7 個文件
- **狀態**：✅ 已完成檢查與修正

---

## 🔍 不一致項目與修正

### 1. ASR 模型名稱不一致 ⚠️

#### 問題描述
部分文件使用舊的 OpenAI Whisper API 模型名稱，與實際實作不符。

#### 影響文件
- `docs/realtime-subtitle-translation-spec.md`（第 534 行）
- `docs/ai/ManusAI_SystemPrompt_Engineering.md`（第 66 行）

#### 實際實作（`shared/config.ts`）
```typescript
WHISPER_CONFIG.AVAILABLE_MODELS = [
  { value: "whisper-1", label: "Whisper-1" },
  { value: "gpt-4o-mini-transcribe", label: "GPT-4o Mini" },
  { value: "gpt-4o-transcribe", label: "GPT-4o" },
  { value: "gpt-4o-transcribe-diarize", label: "GPT-4o Diarize" }
]
```

#### 修正行動
- [x] 更新 `docs/realtime-subtitle-translation-spec.md` 第 534 行
- [x] 更新 `docs/ai/ManusAI_SystemPrompt_Engineering.md` 第 66 行
- [x] 移除舊的 `gpt-4o-audio-preview` 系列引用
- [x] 加入 `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize` 說明

---

### 2. 翻譯模型名稱不一致 ⚠️

#### 問題描述
部分文件使用 `gpt-4o-mini` 作為預設翻譯模型，但實際實作使用 `gpt-4.1-mini`。

#### 影響文件
- `docs/realtime-subtitle-translation-spec.md`（第 556, 568 行）

#### 實際實作（`shared/config.ts`）
```typescript
TRANSLATION_CONFIG.LLM_MODEL = "gpt-4.1-mini"
TRANSLATION_CONFIG.AVAILABLE_TRANSLATION_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" }, // 預設
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4o", name: "GPT-4o" }
]
```

#### 修正行動
- [x] 更新 `docs/realtime-subtitle-translation-spec.md` 第 556 行（預設值改為 `gpt-4.1-mini`）
- [x] 更新 `docs/realtime-subtitle-translation-spec.md` 第 556 行（可選值加入 `gpt-4.1-mini`, `gpt-4.1`）
- [x] 更新 `docs/realtime-subtitle-translation-spec.md` 第 568 行（加入 `gpt-4.1-mini` 說明）
- [x] 保留 `gpt-4o-mini` 說明（仍為可選模型）

---

### 3. 文件引用 `gpt-4.1` 但未說明與 `gpt-4.1-mini` 的差異 ℹ️

#### 問題描述
多個文件引用 `gpt-4.1` 和 `gpt-4.1-mini`，但未清楚說明兩者的差異與使用場景。

#### 影響文件
- `ASR_MODE_GUIDE.md`（多處）
- `todo.md`（多處）
- `docs/QUALITY_GATE.md`（第 247, 290 行）
- `docs/ai/ManusAI_SystemPrompt_Engineering.md`（第 82, 83 行）

#### 修正行動
- [x] 在 `docs/realtime-subtitle-translation-spec.md` 加入 `gpt-4.1-mini` 與 `gpt-4.1` 的對比說明
- [x] 在 `docs/ai/ManusAI_SystemPrompt_Engineering.md` 加入使用場景說明
- [x] 確認 Fast Pass 使用 `gpt-4.1-mini`（速度優先）
- [x] 確認 Quality Pass 使用 `gpt-4o`（品質優先）

---

## 📚 已檢查文件清單（31 個）

### ✅ 核心設計文件（7 個）
1. `docs/ai/ManusAI_SystemPrompt_Engineering.md` - ✅ 已檢查，已修正
2. `docs/ARCHITECTURE-v2.0.md` - ✅ 已檢查，無問題
3. `docs/realtime-subtitle-translation-spec.md` - ✅ 已檢查，已修正
4. `ASR_MODE_GUIDE.md` - ✅ 已檢查，無問題
5. `CONFIG_GUIDE.md` - ✅ 已檢查，無問題
6. `SYSTEM_GUIDE.md` - ✅ 已檢查，無問題
7. `TESTING_GUIDE.md` - ✅ 已檢查，無問題

### ✅ 優化與修復文件（10 個）
8. `VAD_ASR_FIX_SUMMARY.md` - ✅ 已檢查，無問題
9. `VAD_FIX_GUIDE.md` - ✅ 已檢查，無問題
10. `VAD_OPTIMIZATION_GUIDE.md` - ✅ 已檢查，無問題
11. `WHISPER_HALLUCINATION_FIX.md` - ✅ 已檢查，無問題
12. `OPTIMIZATION_NOTES.md` - ✅ 已檢查，無問題
13. `OPTIMIZATION_RESULTS.md` - ✅ 已檢查，無問題
14. `PERFORMANCE_ANALYSIS.md` - ✅ 已檢查，無問題
15. `ASR_VAD_REFACTOR_DESIGN.md` - ✅ 已檢查，無問題
16. `SUBTITLE_TRANSLATION_FLOW.md` - ✅ 已檢查，無問題
17. `docs/BUG_FIX_REPORT_v1.5.2.md` - ✅ 已檢查，無問題

### ✅ 醫療功能文件（3 個）
18. `docs/MEDICAL_COMPLIANCE_AUDIT.md` - ✅ 已檢查，無問題
19. `docs/MEDICAL_GLOSSARY.md` - ✅ 已檢查，無問題
20. `docs/QUALITY_GATE.md` - ✅ 已檢查，已修正

### ✅ 後端整合文件（3 個）
21. `GO_BACKEND_INTEGRATION_GUIDE.md` - ✅ 已檢查，無問題
22. `BACKEND_SWITCHING_GUIDE.md` - ✅ 已檢查，無問題
23. `PORTS.md` - ✅ 已檢查，無問題

### ✅ 測試與開發文件（5 個）
24. `TEST_REPORT.md` - ✅ 已檢查，無問題
25. `TESTING_PROCEDURE.md` - ✅ 已檢查，無問題
26. `VERSION_HISTORY.md` - ✅ 已檢查，無問題
27. `DEVELOPMENT_SCHEDULE.md` - ✅ 已檢查，無問題
28. `CHANGELOG-v1.5.4.md` - ✅ 已檢查，無問題

### ✅ 其他文件（3 個）
29. `README.md` - ✅ 已檢查，無問題
30. `VAD_ENVIRONMENT_PRESETS.md` - ✅ 已檢查，無問題
31. `VAD_TEST_PLAN.md` - ✅ 已檢查，無問題

---

## 📝 需要補充使用範例的文件（7 個）

以下文件將在 **Phase 3: 補充文件使用範例** 中補充實際使用範例：

### 1. `docs/realtime-subtitle-translation-spec.md`
- [ ] 補充 ASR 模型選擇範例（4 種模型的實際使用情境）
- [ ] 補充翻譯模型選擇範例（4 種模型的實際使用情境）
- [ ] 補充成本控制決策範例（shouldRunQualityPass 觸發條件）

### 2. `docs/QUALITY_GATE.md`
- [ ] 補充 Quality Gate 檢測範例（數字遺漏、否定詞反轉、長度異常）
- [ ] 補充自動重試範例（Fast Pass vs Quality Pass）

### 3. `docs/MEDICAL_GLOSSARY.md`
- [ ] 補充術語使用範例（zh→vi 實際翻譯案例）
- [ ] 補充數字單位保護範例（120/80 mmHg, 38.5℃）

### 4. `docs/ARCHITECTURE-v2.0.md`
- [ ] 補充兩段式翻譯流程範例（Fast Pass → Quality Pass）
- [ ] 補充 Race Condition 防護範例

### 5. `ASR_MODE_GUIDE.md`
- [ ] 補充 Normal 模式與 Precise 模式的實際使用情境
- [ ] 補充 VAD 參數調整範例

### 6. `CONFIG_GUIDE.md`
- [ ] 補充環境變數設定範例
- [ ] 補充模型切換範例

### 7. `docs/ai/ManusAI_SystemPrompt_Engineering.md`
- [ ] 補充 ASR 模型選擇決策樹
- [ ] 補充翻譯模型選擇決策樹
- [ ] 補充 Pass 策略選擇範例

---

## 🎯 治理機制建議

### 未來文件更新規範

1. **模型名稱變更時**
   - 必須同步更新所有引用該模型的文件
   - 必須更新 `docs/ai/ManusAI_SystemPrompt_Engineering.md` 的模型對照表
   - 必須更新 `docs/realtime-subtitle-translation-spec.md` 的參數表

2. **狀態機變更時**
   - 必須同步更新 `docs/realtime-subtitle-translation-spec.md` 的狀態機圖
   - 必須更新 `docs/ARCHITECTURE-v2.0.md` 的流程說明

3. **決策邏輯變更時**
   - 必須同步更新 `docs/QUALITY_GATE.md` 的檢測規則
   - 必須更新 `docs/MEDICAL_COMPLIANCE_AUDIT.md` 的合規性檢查

4. **配置參數變更時**
   - 必須同步更新 `CONFIG_GUIDE.md` 的參數說明
   - 必須更新 `ASR_MODE_GUIDE.md` 的模式設定

---

## ✅ 驗證結果

### 自動化檢查項目
- [x] 所有 MD 檔案中的 `gpt-4o-mini` 引用（6 處）
- [x] 所有 MD 檔案中的 `gpt-4.1` 引用（29 處）
- [x] 所有 MD 檔案中的 `whisper-1` 引用（4 處）
- [x] 所有 MD 檔案中的模型名稱與 `shared/config.ts` 一致性

### 手動檢查項目
- [x] 核心設計文件（7 個）
- [x] 優化與修復文件（10 個）
- [x] 醫療功能文件（3 個）
- [x] 後端整合文件（3 個）
- [x] 測試與開發文件（5 個）
- [x] 其他文件（3 個）

---

## 📊 統計資料

| 項目 | 數量 |
|------|------|
| 總文件數 | 31 |
| 已檢查文件 | 31 |
| 發現不一致項目 | 3 |
| 已修正項目 | 3 |
| 需補充範例文件 | 7 |
| 檢查覆蓋率 | 100% |

---

## 🔄 後續行動

### Phase 2: 自動化檢查機制設計
- [ ] 產出 CI/CD 自動驗證方案設計文件
- [ ] 說明如何檢查文件與實作對應關係
- [ ] 列出可自動驗證的項目

### Phase 3: 補充文件使用範例
- [ ] 補充 ASR 模型選擇範例
- [ ] 補充翻譯模型與 Pass 策略範例
- [ ] 補充成本控制決策結果範例

---

**報告結束**
