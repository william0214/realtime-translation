# GitHub Actions 設定指南

由於 GitHub App 權限限制，無法自動推送 workflow 檔案。請按照以下步驟手動設定。

---

## 📋 設定步驟

### 步驟 1：前往 GitHub Repository

開啟瀏覽器，前往：
```
https://github.com/william0214/realtime-translation
```

### 步驟 2：建立 Workflow 檔案

1. 點擊 **"Add file"** → **"Create new file"**
2. 在檔案名稱欄位輸入：`.github/workflows/doc-check.yml`
3. 複製以下完整內容到編輯器

### 步驟 3：複製 Workflow 內容

```yaml
name: Documentation Check

on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'docs/**'
      - 'shared/config.ts'
      - 'scripts/doc-check/**'
  pull_request:
    branches:
      - main
      - develop
    paths:
      - 'docs/**'
      - 'shared/config.ts'
      - 'scripts/doc-check/**'
  workflow_dispatch:

jobs:
  doc-check:
    name: Check Documentation Consistency
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      
      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT
      
      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run documentation checks
        id: doc-check
        run: |
          pnpm doc-check --github-actions > check-output.txt 2>&1 || echo "check_failed=true" >> $GITHUB_OUTPUT
          cat check-output.txt
        continue-on-error: true
      
      - name: Generate Markdown report
        if: always()
        run: pnpm doc-check:md
      
      - name: Upload check report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: doc-check-report
          path: doc-check-report.md
          retention-days: 30
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            
            // 讀取報告
            let report = '';
            try {
              report = fs.readFileSync('doc-check-report.md', 'utf8');
            } catch (error) {
              report = '無法讀取檢查報告';
            }
            
            // 截斷過長的報告
            const maxLength = 60000;
            if (report.length > maxLength) {
              report = report.substring(0, maxLength) + '\n\n... (報告過長，已截斷)';
            }
            
            // 發布評論
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 📋 文件檢查報告\n\n${report}\n\n---\n*此報告由 GitHub Actions 自動產生*`
            });
      
      - name: Fail if checks failed
        if: steps.doc-check.outputs.check_failed == 'true'
        run: |
          echo "❌ 文件檢查發現錯誤，請查看報告並修正"
          exit 1
      
      - name: Success
        if: steps.doc-check.outputs.check_failed != 'true'
        run: |
          echo "✅ 所有文件檢查通過！"
```

### 步驟 4：提交檔案

1. 在頁面底部的 "Commit new file" 區域
2. Commit message 填寫：`ci: 加入自動化文件檢查 workflow`
3. 選擇 "Commit directly to the main branch"
4. 點擊 **"Commit new file"**

---

## ✅ 驗證設定

### 1. 檢查 Workflow 是否建立成功

前往：
```
https://github.com/william0214/realtime-translation/actions
```

應該會看到 "Documentation Check" workflow。

### 2. 手動觸發測試

1. 點擊 "Documentation Check" workflow
2. 點擊右上角的 "Run workflow"
3. 選擇 "main" 分支
4. 點擊 "Run workflow" 按鈕

### 3. 查看執行結果

- 等待約 1-2 分鐘
- 查看執行結果（綠色勾勾 = 成功，紅色叉叉 = 失敗）
- 點擊執行記錄查看詳細日誌
- 下載 "doc-check-report" artifact 查看完整報告

---

## 🔄 自動觸發條件

設定完成後，workflow 會在以下情況自動執行：

1. **Push 到 main/develop 分支**
   - 修改 `docs/` 目錄下的任何檔案
   - 修改 `shared/config.ts`
   - 修改 `scripts/doc-check/` 目錄下的任何檔案

2. **Pull Request 到 main/develop 分支**
   - 自動執行檢查
   - 在 PR 中留言報告結果

3. **手動觸發**
   - 在 GitHub Actions 頁面點擊 "Run workflow"

---

## 📊 預期結果

執行成功後，您應該會看到：

1. ✅ **Checkout repository** - 下載程式碼
2. ✅ **Setup Node.js** - 安裝 Node.js 22
3. ✅ **Setup pnpm** - 自動使用 package.json 中的版本（10.4.1）
4. ✅ **Install dependencies** - 安裝專案依賴
5. ⚠️ **Run documentation checks** - 執行檢查（可能有警告）
6. ✅ **Generate Markdown report** - 產生報告
7. ✅ **Upload check report** - 上傳報告
8. ✅ **Success** - 檢查完成

---

## 🔧 關鍵修正說明

### pnpm 版本設定

**重要**：此 workflow 已移除 `version: 10` 設定，改為自動讀取 `package.json` 中的 `packageManager` 欄位。

- ✅ **正確做法**：讓 pnpm/action-setup 自動讀取 package.json
- ❌ **錯誤做法**：同時在 workflow 和 package.json 指定版本

這樣可以避免版本衝突錯誤：
```
ERR_PNPM_BAD_PM_VERSION: Multiple versions of pnpm specified
```

---

## 🐛 疑難排解

### 問題 1：找不到 pnpm doc-check 命令

**原因**：package.json 中沒有定義 doc-check script

**解決**：確認 package.json 包含以下內容：
```json
{
  "scripts": {
    "doc-check": "tsx scripts/doc-check/index.ts",
    "doc-check:md": "tsx scripts/doc-check/index.ts --format=markdown --output=doc-check-report.md",
    "doc-check:json": "tsx scripts/doc-check/index.ts --format=json --output=doc-check-report.json"
  }
}
```

### 問題 2：執行失敗，找不到檔案

**原因**：檢查腳本尚未推送到 GitHub

**解決**：確認以下檔案都已推送：
- `scripts/doc-check/index.ts`
- `scripts/doc-check/types.ts`
- `scripts/doc-check/utils.ts`
- `scripts/doc-check/reporter.ts`
- `scripts/doc-check/check-models.ts`
- `scripts/doc-check/check-config.ts`
- `scripts/doc-check/check-paths.ts`

### 問題 3：報告顯示大量錯誤

**原因**：文件與實作不一致

**解決**：
1. 下載 doc-check-report.md artifact
2. 根據報告修正文件
3. 重新推送並驗證

### 問題 4：pnpm 版本衝突

**原因**：同時在 workflow 和 package.json 指定版本

**解決**：已在此版本修正，workflow 會自動讀取 package.json 中的版本

---

## 📞 需要協助？

如果遇到任何問題，請查看：
1. GitHub Actions 執行日誌
2. doc-check-report.md artifact
3. scripts/doc-check/README.md

---

**設定完成後，自動化文件檢查就會開始運作！** 🎉
