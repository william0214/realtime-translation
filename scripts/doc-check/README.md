# 文件檢查工具 (Documentation Check Tool)

自動化檢查文件與程式碼的一致性，確保文件內容與實際實作保持同步。

## 📋 功能

### 1. 模型名稱檢查 (Model Name Check)
- 從 `shared/config.ts` 提取所有 ASR 和翻譯模型定義
- 掃描 `docs/` 目錄下的所有 Markdown 檔案
- 檢查文件中引用的模型名稱是否與 config 一致
- 檢測位置：
  - 程式碼區塊中的模型引用
  - 表格中的模型欄位
  - 內文中的反引號標記

### 2. 配置參數檢查 (Config Parameter Check)
- 從 `shared/config.ts` 提取所有配置參數定義
- 檢查文件中的參數表格是否與 config 一致
- 驗證項目：
  - 參數名稱是否存在
  - 預設值是否一致
  - 型別是否一致

### 3. 檔案路徑檢查 (File Path Check)
- 掃描文件中引用的檔案路徑
- 驗證檔案是否存在
- 驗證行號引用是否有效
- 檢測位置：
  - 程式碼區塊中的路徑引用
  - 內文中的反引號標記
  - Markdown 連結

## 🚀 使用方式

### 本地執行

```bash
# 執行所有檢查（控制台輸出）
pnpm doc-check

# 產生 Markdown 報告
pnpm doc-check:md

# 產生 JSON 報告
pnpm doc-check:json
```

### 命令列選項

```bash
# 指定輸出格式
tsx scripts/doc-check/index.ts --format=console|markdown|json

# 指定輸出檔案
tsx scripts/doc-check/index.ts --output=report.md

# GitHub Actions 模式（產生註解）
tsx scripts/doc-check/index.ts --github-actions
```

## 🤖 GitHub Actions 整合

此工具已整合到 GitHub Actions，會在以下情況自動執行：

1. **Push 到 main/develop 分支**
   - 修改 `docs/` 目錄下的檔案
   - 修改 `shared/config.ts`
   - 修改 `scripts/doc-check/` 目錄

2. **Pull Request 到 main/develop 分支**
   - 自動在 PR 中留言報告結果
   - 如果有錯誤，CI 會失敗

3. **手動觸發**
   - 在 GitHub Actions 頁面手動執行

### Workflow 檔案

`.github/workflows/doc-check.yml`

## 📊 報告格式

### 控制台報告
```
===========================================
📋 文件檢查報告
===========================================

📊 檢查摘要
-------------------------------------------
檢查時間: 2025-12-27T15:30:00.000Z
總檔案數: 15
總問題數: 3
  - 錯誤 (❌): 1
  - 警告 (⚠️): 2
  - 資訊 (ℹ️): 0
總耗時: 1.23s

===========================================
📝 模型名稱檢查
===========================================
檢查檔案數: 15
發現問題數: 1
耗時: 456ms

問題列表:
-------------------------------------------

❌ 未知的模型名稱: "gpt-4o-mini"
   檔案: docs/spec.md:123
   實際: gpt-4o-mini
   建議: 請檢查 shared/config.ts 中是否定義此模型
```

### Markdown 報告
產生結構化的 Markdown 報告，適合保存或分享。

### JSON 報告
產生機器可讀的 JSON 格式，適合整合到其他工具。

## 🔧 開發

### 檔案結構

```
scripts/doc-check/
├── index.ts           # 主程式
├── types.ts           # 型別定義
├── utils.ts           # 共用工具函數
├── reporter.ts        # 報告產生器
├── check-models.ts    # 模型名稱檢查
├── check-config.ts    # 配置參數檢查
├── check-paths.ts     # 檔案路徑檢查
└── README.md          # 本文件
```

### 新增檢查項目

1. 在 `types.ts` 中定義新的 `CheckType`
2. 建立新的檢查模組（例如 `check-xxx.ts`）
3. 實作檢查邏輯，返回 `CheckResult`
4. 在 `index.ts` 中註冊新的檢查

### 範例：新增狀態機檢查

```typescript
// check-state-machine.ts
import { CheckResult, CheckIssue } from "./types";

export async function checkStateMachine(): Promise<CheckResult> {
  const startTime = Date.now();
  const issues: CheckIssue[] = [];
  
  // 實作檢查邏輯
  // ...
  
  return {
    type: "state-machine",
    name: "狀態機檢查",
    filesChecked: 10,
    issues,
    duration: Date.now() - startTime,
  };
}
```

```typescript
// index.ts
import { checkStateMachine } from "./check-state-machine";

// 在 main() 函數中加入
const stateMachineResult = await checkStateMachine();
results.push(stateMachineResult);
```

## 📝 最佳實踐

### 文件撰寫建議

1. **模型名稱**
   - 使用反引號標記模型名稱：`` `gpt-4o` ``
   - 確保模型名稱與 `shared/config.ts` 完全一致

2. **配置參數**
   - 使用表格列出參數，包含「參數」和「預設值」欄位
   - 預設值必須與 config 一致

3. **檔案路徑**
   - 使用相對路徑（相對於專案根目錄）
   - 使用反引號標記路徑：`` `client/src/pages/Home.tsx` ``
   - 如果引用特定行號，使用格式：`` `file.ts:123` ``

### 維護建議

1. **定期執行檢查**
   - 每次修改 config 後執行 `pnpm doc-check`
   - 每次更新文件後執行檢查

2. **修正問題**
   - 優先修正錯誤（❌）
   - 評估警告（⚠️）是否需要修正
   - 資訊（ℹ️）僅供參考

3. **持續改進**
   - 根據實際需求新增檢查項目
   - 調整檢查規則的嚴格程度
   - 優化檢查效能

## 🐛 已知限制

1. **模型名稱檢測**
   - 可能誤判包含 "gpt" 或 "whisper" 的非模型字串
   - 無法檢測動態生成的模型名稱

2. **配置參數檢測**
   - 僅檢查表格中的參數
   - 無法檢測內文中的參數描述

3. **檔案路徑檢測**
   - 僅檢查明確的檔案路徑
   - 無法檢測動態路徑或模式匹配

## 📚 相關文件

- [設計規格文件](../../docs/realtime-subtitle-translation-spec.md)
- [醫療合規性診斷](../../docs/MEDICAL_COMPLIANCE_AUDIT.md)
- [架構設計文件](../../docs/ARCHITECTURE-v2.0.md)

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request 來改進此工具！

## 📄 授權

MIT License
