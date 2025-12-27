# 🚨 緊急修正指南：GitHub Actions pnpm 錯誤

## 當前錯誤

```
Error: Multiple versions of pnpm specified:
  - version 10 in the GitHub Action config with the key "version"
  - version pnpm@10.4.1+sha512... in the package.json with the key "packageManager"
```

---

## ⚡ 快速修正（3 步驟，1 分鐘完成）

### 步驟 1：開啟 workflow 檔案

點擊此連結直接開啟編輯頁面：
```
https://github.com/william0214/realtime-translation/edit/main/.github/workflows/doc-check.yml
```

或手動前往：
1. 開啟 https://github.com/william0214/realtime-translation
2. 點擊 `.github/workflows/doc-check.yml`
3. 點擊右上角的鉛筆圖示（編輯）

---

### 步驟 2：找到並修改這 4 行

**找到第 30-34 行**（約在檔案中間位置）：

```yaml
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
```

**修改為**（只需改動 2 行）：

```yaml
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          run_install: false
```

### 視覺對比

```diff
       - name: Setup pnpm
         uses: pnpm/action-setup@v4
         with:
-          version: 10
+          run_install: false
```

---

### 步驟 3：提交變更

1. 滾動到頁面底部
2. 在 "Commit message" 填寫：
   ```
   fix: 修正 pnpm 版本衝突（移除 version: 10，加入 run_install: false）
   ```
3. 選擇 "Commit directly to the main branch"
4. 點擊綠色按鈕 **"Commit changes"**

---

## ✅ 驗證修正

### 1. 自動觸發

提交後，GitHub Actions 會自動執行（因為您修改了 `.github/workflows/` 目錄）。

### 2. 查看執行結果

1. 前往 https://github.com/william0214/realtime-translation/actions
2. 點擊最新的 "Documentation Check" 執行記錄
3. 等待約 1-2 分鐘
4. 確認所有步驟都是綠色勾勾 ✅

### 3. 預期結果

**Setup pnpm** 步驟應該顯示：
```
Installing pnpm 10.4.1
pnpm installed successfully
```

**不應該再看到**：
- ❌ `Error: Multiple versions of pnpm specified`
- ❌ `pnpm: command not found`

---

## 📋 完整修正後的 Setup pnpm 區塊

修正後，您的 workflow 檔案中的 Setup pnpm 區塊應該長這樣：

```yaml
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          run_install: false
      
      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT
```

---

## 🔍 為什麼這樣修正？

| 配置 | 結果 | 說明 |
|------|------|------|
| `version: 10` | ❌ 錯誤 | 與 package.json 的 packageManager 衝突 |
| 無設定 | ❌ 可能失敗 | pnpm 可能不會正確安裝 |
| `run_install: false` | ✅ 正確 | 自動讀取 package.json，確保 pnpm 可用 |

---

## 🆘 如果仍然失敗

### 方案 A：複製完整檔案

如果手動修改有困難，可以：

1. 開啟編輯頁面
2. **全選並刪除**原有內容（Ctrl+A, Delete）
3. 複製 `WORKFLOW_FIX_V2.yml` 的完整內容
4. 貼上
5. 提交

### 方案 B：檢查是否有其他錯誤

如果修正後仍有問題，請：

1. 複製完整的錯誤訊息
2. 提供 GitHub Actions 執行日誌的截圖
3. 我會協助進一步診斷

---

## 📞 需要協助？

如果遇到任何問題：
1. 確認您修改的是 `.github/workflows/doc-check.yml` 檔案
2. 確認修改後的內容與上面的範例一致
3. 確認提交時沒有語法錯誤（GitHub 編輯器會自動檢查 YAML 語法）

---

**修正完成後，GitHub Actions 就能正常執行文件檢查了！** 🎉
