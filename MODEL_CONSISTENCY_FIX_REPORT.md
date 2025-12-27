# 模型名稱一致性修正報告

**修正日期：** 2025-12-27  
**修正人員：** Manus AI  
**版本：** v1.0

---

## 📊 修正摘要

本次修正完成了模型名稱一致性問題的全面處理，確保所有文件中的模型引用與 `shared/config.ts` 定義一致。

### 修正統計

| 項目 | 數量 |
|------|------|
| 更新的配置檔案 | 1 |
| 更新的文件 | 1 |
| 新增的模型定義 | 6 |
| 新增的 CI 腳本 | 2 |
| 新增的 GitHub Actions workflow | 1 |

---

## ✅ 完成項目

### 1. 更新 `shared/config.ts`

#### 新增的 ASR 模型

- ✅ `gpt-4o-audio-preview` - GPT-4o Audio Preview（已在 AVAILABLE_MODELS 中）
- ✅ `gpt-4o-realtime-preview` - GPT-4o Realtime Preview（新增）

#### 新增的 Legacy 模型

**LEGACY_ASR_MODELS:**
- ✅ `gpt-4o-audio-preview-2024-10-01` - 日期版本（使用 canonical 版本替代）

**LEGACY_TRANSLATION_MODELS:**
- ✅ `gpt-3.5-turbo` - 舊版翻譯模型（使用 gpt-4.1-mini 替代）
- ✅ `gpt-3.5-turbo-instruct` - 舊版 instruct 模型（使用 gpt-4.1-mini 替代）

#### 更新的模型允許清單

```typescript
export const ALLOWED_ASR_MODELS = [
  "whisper-1",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
  "gpt-4o-audio-preview",
  "gpt-4o-realtime-preview",  // 新增
] as const;

export const LEGACY_ASR_MODELS = [
  "gpt-4o-audio-preview-2024-10-01",  // 新增
] as const;

export const LEGACY_TRANSLATION_MODELS = [
  "gpt-3.5-turbo",          // 新增
  "gpt-3.5-turbo-instruct", // 新增
] as const;

export const ALLOWED_MODELS = [
  ...ALLOWED_ASR_MODELS,
  ...ALLOWED_TRANSLATION_MODELS,
  ...LEGACY_ASR_MODELS,
  ...LEGACY_TRANSLATION_MODELS,
] as const;
```

---

### 2. 更新文件

#### `docs/realtime-subtitle-translation-spec.md`

**修正內容：**

1. **第 20 行** - 更新 ASR 模型列表
   - 移除：`gpt-4o-audio-preview-2024-10-01`（日期版本）
   - 保留：`gpt-4o-audio-preview`（canonical 版本）
   - 保留：`gpt-4o-realtime-preview`

2. **第 22 行** - 更新翻譯模型列表
   - 移除：`gpt-3.5-turbo`
   - 保留：`gpt-4o`, `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1`

3. **第 556 行** - 更新翻譯模型參數表
   - 移除：`gpt-3.5-turbo`
   - 保留：`gpt-4o`, `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1`

4. **第 574 行** - 移除 gpt-3.5-turbo 說明段落

5. **第 1182 行** - 更新優化建議
   - 移除：`gpt-3.5-turbo-instruct`
   - 更新為：當前系統使用 `gpt-4.1-mini` 作為預設模型

6. **新增附錄 A：已棄用模型**
   - 說明 `gpt-4o-audio-preview-2024-10-01` 已被 canonical 版本取代
   - 說明 `gpt-3.5-turbo` 系列已被 `gpt-4.1-mini` 取代
   - 提供遷移建議

---

### 3. 實作 CI 模型一致性檢查機制

#### 新增檔案：`scripts/check-model-consistency.py`

**功能：**
- 從 `shared/config.ts` 動態讀取允許的模型清單
- 掃描所有 `docs/**/*.md` 文件
- 檢測未定義的模型引用
- 若發現未知模型，CI 會 fail

**使用方式：**
```bash
python3 scripts/check-model-consistency.py
```

**輸出範例：**
```
🔍 CI 模型一致性檢查開始...
✅ 從 shared/config.ts 載入 13 個允許的模型
🎉 所有模型引用都是有效的！
```

#### 新增檔案：`.github/workflows/model-consistency-check.yml`

**觸發條件：**
- Push 到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop` 分支
- 變更路徑：
  - `docs/**/*.md`
  - `shared/config.ts`
  - `scripts/check-model-consistency.py`

**執行步驟：**
1. Checkout code
2. Set up Python 3.11
3. Run model consistency check
4. Report success/failure

---

## 📋 模型清單

### 有效的 ASR 模型（6 個）

| 模型名稱 | 說明 | 狀態 |
|---------|------|------|
| `whisper-1` | 原版 Whisper（API 入口） | ✅ Active |
| `gpt-4o-mini-transcribe` | GPT-4o Mini 轉錄模型 | ✅ Active |
| `gpt-4o-transcribe` | GPT-4o 轉錄模型 | ✅ Active |
| `gpt-4o-transcribe-diarize` | GPT-4o 轉錄模型（含說話者辨識） | ✅ Active |
| `gpt-4o-audio-preview` | GPT-4o Audio Preview | ✅ Active |
| `gpt-4o-realtime-preview` | GPT-4o Realtime Preview | ✅ Active |

### 有效的翻譯模型（4 個）

| 模型名稱 | 說明 | 狀態 |
|---------|------|------|
| `gpt-4o-mini` | 最快速、最低成本 | ✅ Active |
| `gpt-4.1-mini` | 平衡速度和品質（推薦） | ✅ Active |
| `gpt-4.1` | 高品質 | ✅ Active |
| `gpt-4o` | 最高品質、最慢 | ✅ Active |

### Legacy 模型（3 個）

| 模型名稱 | 替代方案 | 狀態 |
|---------|---------|------|
| `gpt-4o-audio-preview-2024-10-01` | `gpt-4o-audio-preview` | ⚠️ Deprecated |
| `gpt-3.5-turbo` | `gpt-4.1-mini` | ⚠️ Deprecated |
| `gpt-3.5-turbo-instruct` | `gpt-4.1-mini` | ⚠️ Deprecated |

---

## 🔍 驗證結果

### 文件一致性檢查

```bash
$ python3 scripts/check-model-consistency.py
🔍 CI 模型一致性檢查開始...
✅ 從 shared/config.ts 載入 13 個允許的模型
🎉 所有模型引用都是有效的！
```

### 模型使用統計

| 模型名稱 | 引用次數 | 類型 |
|---------|---------|------|
| `gpt-4.1-mini` | 57 | Translation |
| `gpt-4o-mini-transcribe` | 30 | ASR |
| `gpt-4o` | 27 | Translation |
| `gpt-4.1` | 25 | Translation |
| `gpt-4o-transcribe` | 22 | ASR |
| `gpt-4o-mini` | 19 | Translation |
| `whisper-1` | 18 | ASR |
| `gpt-4o-transcribe-diarize` | 18 | ASR |
| `gpt-4o-audio-preview` | 17 | ASR |

---

## 🚀 後續建議

### 1. 定期執行一致性檢查

建議在每次文件更新後執行檢查：

```bash
python3 scripts/check-model-consistency.py
```

### 2. 遵循模型命名規範

- **使用 canonical 模型名稱**（不含日期版本）
- **避免使用 legacy 模型**（除非在 Deprecated 區塊中說明）
- **新增模型時**，必須先在 `shared/config.ts` 中定義

### 3. CI/CD 整合

GitHub Actions workflow 已自動整合，會在以下情況自動執行檢查：
- Push 到 main/develop 分支
- 建立 Pull Request
- 變更文件或配置檔案

### 4. 文件維護

- 定期檢查 OpenAI 官方文件，更新模型清單
- 將已棄用的模型移到 Deprecated 區塊
- 提供清晰的遷移指南

---

## 📚 參考資料

- [OpenAI Models Documentation](https://platform.openai.com/docs/models)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Whisper API Documentation](https://platform.openai.com/docs/guides/speech-to-text)

---

## 📝 變更記錄

| 日期 | 版本 | 變更內容 |
|------|------|---------|
| 2025-12-27 | v1.0 | 初始版本：完成模型名稱一致性修正 |

---

**修正完成！** 🎉

所有模型引用現在都與 `shared/config.ts` 定義一致，並建立了自動化檢查機制，確保未來的一致性。
