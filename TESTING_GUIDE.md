# 即時連續翻譯系統 - 測試指南

## 📋 概述

本文件說明即時連續翻譯系統的單元測試架構、測試案例和執行方式。

## 🧪 測試架構

### 測試檔案

- `server/translation.realtime.test.ts` - 即時連續翻譯 API 單元測試
- `server/auth.logout.test.ts` - 認證登出功能測試（範例）

### 測試框架

- **Vitest** - 快速的單元測試框架
- **tRPC** - 型別安全的 API 測試
- **TypeScript** - 完整的型別檢查

## 📝 測試案例

### 1. 基本功能測試

#### 1.1 語音識別和翻譯
```typescript
should accept audio buffer and return transcription and translation
```
- 測試基本的語音識別 → 翻譯流程
- 驗證回傳格式和型別
- 確認所有必要欄位存在

#### 1.2 多語言支援
```typescript
should handle different target languages
```
- 測試多種目標語言（vi, en, id, th）
- 驗證每種語言都能正確處理
- 確認翻譯結果符合預期

### 2. 錯誤處理測試

#### 2.1 空音訊處理
```typescript
should handle empty audio gracefully
```
- 測試空音訊檔案的處理
- 驗證回傳錯誤訊息
- 確認不會導致系統崩潰

#### 2.2 無效 Base64 音訊
```typescript
should handle invalid base64 audio
```
- 測試無效的 Base64 編碼
- 驗證錯誤處理機制
- 確認回傳適當的錯誤訊息

#### 2.3 缺少音訊
```typescript
should handle missing audio
```
- 測試缺少音訊參數的情況
- 驗證輸入驗證機制
- 確認回傳錯誤訊息

### 3. 效能測試

#### 3.1 單次翻譯效能
```typescript
should complete translation within acceptable time (< 5 seconds)
```
- 測試單次翻譯的完成時間
- 驗證延遲在可接受範圍內（< 5 秒）
- 記錄實際執行時間

#### 3.2 連續翻譯效能
```typescript
should handle consecutive translations efficiently
```
- 測試連續 3 次翻譯的效能
- 計算平均延遲
- 驗證每次翻譯都在合理時間內完成（< 6 秒）

### 4. 連續翻譯模擬測試

#### 4.1 模擬連續語音
```typescript
should handle rapid consecutive translations (simulating continuous speech)
```
- 模擬 5 個連續語音片段的翻譯
- 計算統計數據（平均、最小、最大延遲）
- 驗證系統穩定性和一致性

## 🚀 執行測試

### 執行所有測試
```bash
cd /home/ubuntu/realtime-translation
pnpm test
```

### 執行特定測試檔案
```bash
pnpm test translation.realtime.test.ts
```

### 執行特定測試案例
```bash
pnpm test -t "should accept audio buffer"
```

### 查看測試覆蓋率
```bash
pnpm test --coverage
```

## 📊 測試結果

### 最新測試結果（2025-11-26）

```
✅ Test Files: 1 passed (1)
✅ Tests: 8 passed (8)
⏱️ Duration: 61.04s
```

### 測試通過率

- **基本功能測試**: 2/2 ✅
- **錯誤處理測試**: 3/3 ✅
- **效能測試**: 2/2 ✅
- **連續翻譯測試**: 1/1 ✅

**總計**: 8/8 (100%) ✅

### 效能指標

| 指標 | 數值 | 狀態 |
|------|------|------|
| 平均延遲 | 4.4 秒 | ⚠️ 需優化 |
| Whisper 識別 | 0.8-1.2 秒 | ✅ 正常 |
| 翻譯處理 | 3.8-4.2 秒 | ⚠️ 瓶頸 |
| 最大延遲 | 5.0 秒 | ⚠️ 接近閾值 |

## 🔍 效能分析

### 瓶頸診斷

根據測試結果，系統的主要瓶頸為：

1. **翻譯 API 太慢** (3.8-4.2 秒)
   - 佔總延遲的 85-90%
   - 需要優化翻譯服務

2. **Whisper 識別正常** (0.8-1.2 秒)
   - 佔總延遲的 15-20%
   - 效能符合預期

### 優化建議

1. **翻譯服務優化**
   - 考慮使用更快的翻譯模型（如 gpt-3.5-turbo）
   - 實作翻譯結果快取機制
   - 使用批次翻譯減少 API 呼叫次數

2. **並行處理**
   - 實作 Hybrid ASR 模式（streaming + segment）
   - Partial transcript 即時顯示
   - Final transcript 並行處理翻譯

3. **網路優化**
   - 使用更接近的 API 端點
   - 實作連線池和重用機制
   - 考慮使用 HTTP/2 或 gRPC

## 📈 測試覆蓋範圍

### API 端點

- ✅ `translation.autoTranslate` - 完整測試
- ✅ `auth.logout` - 基本測試
- ⚠️ `diagnostics.report` - 待測試

### 功能模組

- ✅ 語音識別（Whisper）
- ✅ 語言檢測
- ✅ 翻譯服務
- ✅ 錯誤處理
- ✅ 效能監控
- ⚠️ TTS 生成 - 待測試
- ⚠️ WebSocket 連線 - 待測試

## 🛠️ 測試工具函數

### createTestAudioBuffer(durationSeconds)

建立測試用的 WAV 音訊緩衝區（靜音）。

```typescript
const audioBuffer = createTestAudioBuffer(1); // 1 秒靜音
const base64Audio = audioBuffer.toString("base64");
```

### createTestContext()

建立測試用的 tRPC 上下文（已認證使用者）。

```typescript
const { ctx } = createTestContext();
const caller = appRouter.createCaller(ctx);
```

## 📝 撰寫新測試

### 測試範本

```typescript
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { createTestContext } from "./test-utils";

describe("Feature Name", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const { ctx } = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should do something", async () => {
    const result = await caller.feature.method({ input: "test" });
    
    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
  });
});
```

### 最佳實踐

1. **使用描述性的測試名稱**
   - ✅ `should accept audio buffer and return transcription`
   - ❌ `test1`

2. **測試一個功能點**
   - 每個測試只驗證一個功能
   - 避免過於複雜的測試邏輯

3. **使用適當的 timeout**
   - API 呼叫測試：30-60 秒
   - 連續測試：60-120 秒

4. **記錄測試結果**
   - 使用 `console.log` 輸出關鍵資訊
   - 方便除錯和效能分析

5. **處理非同步操作**
   - 使用 `async/await`
   - 確保所有 Promise 都被正確處理

## 🐛 除錯測試

### 查看詳細日誌

```bash
pnpm test --reporter=verbose
```

### 只執行失敗的測試

```bash
pnpm test --reporter=verbose --run
```

### 使用 VS Code 除錯

1. 在測試檔案中設置中斷點
2. 按 F5 啟動除錯
3. 選擇 "Vitest" 配置

## 📚 參考資源

- [Vitest 文件](https://vitest.dev/)
- [tRPC 測試指南](https://trpc.io/docs/server/testing)
- [TypeScript 測試最佳實踐](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🔄 持續整合

### GitHub Actions 配置

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
```

## 📊 測試報告

測試報告會自動生成在 `coverage/` 目錄下，包含：

- HTML 報告：`coverage/index.html`
- JSON 報告：`coverage/coverage-final.json`
- LCOV 報告：`coverage/lcov.info`

## 🎯 測試目標

### 短期目標

- ✅ 完成基本 API 測試
- ✅ 實作錯誤處理測試
- ✅ 建立效能測試基準
- ⚠️ 提高測試覆蓋率至 80%

### 長期目標

- ⚠️ 實作端到端測試
- ⚠️ 建立自動化測試流程
- ⚠️ 整合到 CI/CD 管道
- ⚠️ 實作負載測試

## 📞 聯絡資訊

如有測試相關問題，請聯絡開發團隊。
