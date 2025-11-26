# 後端切換功能使用指南

## 功能說明

系統支援在 **Node.js 後端** 和 **Go 後端** 之間切換，方便比較兩種實作的效果。

## 如何切換後端

### 方法：連續點擊標題三次

1. 在首頁標題「即時雙向翻譯系統」上**連續點擊三次**（2 秒內）
2. 系統會顯示切換成功的提示訊息
3. 標題旁會顯示目前使用的後端：
   - `(Node.js)` - 使用 Node.js 後端
   - `(Go)` - 使用 Go 後端

### 持久化儲存

- 選擇的後端會儲存在瀏覽器的 localStorage
- 重新整理頁面後會保持上次的選擇

## 兩種後端的差異

### Node.js 後端（預設）

- **技術棧**：Express + tRPC + TypeScript
- **優點**：
  - 與前端整合緊密（同一個專案）
  - 類型安全（TypeScript end-to-end）
  - 開發便利（Hot reload）
- **API 端點**：`/api/trpc/translation.autoTranslate`

### Go 後端

- **技術棧**：Gin + GORM + PostgreSQL
- **優點**：
  - 高效能（Go 語言特性）
  - 獨立部署（微服務架構）
  - 完整的診斷系統
- **API 端點**：`http://localhost:8080/api/v1/asr/segment`（REST）
- **環境變數**：`VITE_GO_BACKEND_URL`（預設 `http://localhost:8080`）

## 設定 Go 後端 URL

如果 Go 後端不在 `http://localhost:8080`，請在管理介面的 Settings → Secrets 加入：

```
VITE_GO_BACKEND_URL=http://your-go-server:8080
```

## 測試建議

1. **Node.js 後端測試**：
   - 點擊標題三次，確認顯示 `(Node.js)`
   - 開始對話，測試語音翻譯
   - 查看 Console 日誌（F12），確認呼叫 `/api/trpc/translation.autoTranslate`

2. **Go 後端測試**：
   - 確保 Go 後端已啟動（`cd backend-go && go run cmd/api/main.go`）
   - 點擊標題三次，切換到 `(Go)`
   - 開始對話，測試語音翻譯
   - 查看 Console 日誌，確認呼叫 `http://localhost:8080/api/v1/asr/segment`

3. **效能比較**：
   - 使用 Console 的時間日誌比較兩種後端的速度
   - 觀察 Whisper 識別時間、翻譯時間、總耗時

## 故障排除

### Go 後端無法連線

**錯誤訊息**：`Failed to fetch` 或 `HTTP error! status: XXX`

**解決方法**：
1. 確認 Go 後端已啟動：`cd backend-go && go run cmd/api/main.go`
2. 確認 CORS 設定正確（Go 後端應允許前端 origin）
3. 檢查 `VITE_GO_BACKEND_URL` 環境變數是否正確

### 切換後沒有反應

**解決方法**：
1. 確認連續點擊三次在 2 秒內完成
2. 檢查 Console 是否有錯誤訊息
3. 重新整理頁面後再試一次

## 實作細節

### 前端程式碼

- **切換邏輯**：`client/src/pages/Home.tsx` - `handleTitleClick()`
- **Go 後端服務**：`client/src/services/goBackend.ts` - `callGoTranslation()`
- **狀態儲存**：`localStorage.getItem("translation-backend")`

### API 呼叫

```typescript
// Node.js 後端
const result = await translateMutation.mutateAsync({
  audioBase64: base64Audio,
  filename: `audio-${Date.now()}.webm`,
  preferredTargetLang: targetLanguage,
});

// Go 後端
const result = await callGoTranslation({
  audioBase64: base64Audio,
  filename: `audio-${Date.now()}.webm`,
  preferredTargetLang: targetLanguage,
});
```

兩種呼叫返回相同的資料結構，確保前端邏輯無需修改。
