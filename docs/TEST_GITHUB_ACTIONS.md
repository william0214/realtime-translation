# GitHub Actions 測試

此檔案用於測試自動化文件檢查的 GitHub Actions workflow。

## 測試時間
2025-12-27 14:40 GMT+8

## 測試目的
驗證 `.github/workflows/doc-check.yml` 是否正確執行：
1. 自動觸發檢查
2. 執行所有檢查腳本
3. 產生檢查報告
4. 上傳報告為 artifact

## 預期結果
- ✅ Workflow 自動執行
- ✅ 檢查所有 Markdown 檔案
- ✅ 產生檢查報告
- ✅ 上傳報告到 GitHub Actions artifacts

## 測試模型引用
以下是一些測試用的模型引用：

### ASR 模型
- `whisper-1`: 原版 Whisper 模型
- `gpt-4o-mini-transcribe`: 快速語音識別模型
- `gpt-4o-transcribe`: 高品質語音識別模型

### 翻譯模型
- `gpt-4.1-mini`: 預設翻譯模型
- `gpt-4o`: 高品質翻譯模型

## 測試配置參數
| 參數名稱 | 預設值 | 說明 |
|---------|--------|------|
| minSpeechDurationMs | 400 | 最小語音持續時間 |
| silenceDurationMs | 600 | 靜音持續時間 |

## 測試檔案路徑
- `shared/config.ts`: 配置檔案
- `client/src/pages/Home.tsx`: 主頁面
- `server/routers.ts`: tRPC 路由

---

**測試狀態**: 待執行
