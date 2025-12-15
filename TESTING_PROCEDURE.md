# 測試程序文件

**專案名稱：** 即時雙向翻譯系統（護理推車）  
**版本：** v1.1.0  
**最後更新：** 2025-12-15

---

## 目錄

1. [測試環境設定](#測試環境設定)
2. [單元測試](#單元測試)
3. [整合測試](#整合測試)
4. [手動測試](#手動測試)
5. [效能測試](#效能測試)
6. [測試報告](#測試報告)
7. [持續整合](#持續整合)

---

## 測試環境設定

### 前置條件

在執行測試前，請確保已完成以下設定：

1. **安裝相依套件**
   ```bash
   cd /home/ubuntu/realtime-translation
   pnpm install
   ```

2. **設定環境變數**
   
   系統已自動注入以下環境變數：
   - `OPENAI_API_KEY` - OpenAI API 金鑰
   - `DATABASE_URL` - 資料庫連線字串
   - `JWT_SECRET` - JWT 簽章密鑰
   - 其他系統環境變數（參考 `server/_core/env.ts`）

3. **資料庫設定**
   ```bash
   pnpm db:push
   ```

4. **測試音訊檔案**
   
   部分測試需要真實音訊檔案，請準備以下檔案：
   - `test-audio-chinese.webm` - 中文語音測試檔案
   - `test-audio-english.webm` - 英文語音測試檔案
   - `test-audio-vietnamese.webm` - 越南語語音測試檔案

---

## 單元測試

### 執行所有單元測試

```bash
pnpm test --run
```

### 執行特定測試檔案

```bash
# 認證測試
pnpm test server/auth.logout.test.ts --run

# 翻譯測試
pnpm test server/translation.test.ts --run

# 對話管理測試
pnpm test server/conversation.test.ts --run
```

### 執行特定測試案例

```bash
pnpm test -t "should accept audio buffer and return transcription" --run
```

### 監視模式（開發時使用）

```bash
pnpm test
```

此模式會監視檔案變更並自動重新執行測試。

---

## 整合測試

### 對話整合測試

測試完整的對話流程：建立對話 → 儲存翻譯 → 結束對話 → 查詢記錄

```bash
pnpm test server/conversation-integration.test.ts --run
```

### OpenAI 整合測試

測試與 OpenAI API 的整合：Whisper ASR、GPT 翻譯、TTS 語音合成

```bash
pnpm test server/openai.test.ts --run
```

**注意：** 此測試會實際呼叫 OpenAI API，會消耗 API 配額。

---

## 手動測試

### 前端 UI 測試

#### 1. 啟動開發伺服器

```bash
cd /home/ubuntu/realtime-translation
pnpm dev
```

伺服器會在 `http://localhost:3000` 啟動。

#### 2. 測試項目

##### 2.1 基本翻譯功能

**測試步驟：**
1. 開啟瀏覽器訪問 `http://localhost:3000`
2. 選擇目標語言（例如：越南語）
3. 點擊「開始對話」按鈕
4. 對著麥克風說中文：「你好，請問需要什麼幫助？」
5. 等待系統識別並翻譯
6. 檢查右側「外國人」欄位是否顯示越南語翻譯
7. 檢查是否播放 TTS 語音

**預期結果：**
- ✅ 左側顯示中文原文
- ✅ 右側顯示越南語翻譯
- ✅ 播放越南語 TTS 語音
- ✅ 延遲 < 5 秒

##### 2.2 即時字幕功能

**測試步驟：**
1. 點擊「開始對話」按鈕
2. 開始說話
3. 觀察是否出現「即時字幕 偵測中...」
4. 繼續說話，觀察即時字幕是否更新
5. 停止說話，等待 500ms
6. 檢查即時字幕是否轉換為最終翻譯

**預期結果：**
- ✅ 說話時顯示「即時字幕 偵測中...」
- ✅ 即時字幕會即時更新（每 300ms）
- ✅ 停止說話後轉換為最終翻譯
- ✅ 最終翻譯會保留在對話記錄中

##### 2.3 結束對話功能（修復驗證）

**測試步驟：**
1. 點擊「開始對話」按鈕
2. 說幾句話，產生多個即時字幕
3. 點擊「結束對話」按鈕
4. 檢查所有「即時字幕 偵測中...」是否消失

**預期結果：**
- ✅ 所有 partial 訊息（即時字幕）都被清除
- ✅ 只保留最終翻譯結果
- ✅ 狀態指示器顯示「閒置」
- ✅ 音量指示器歸零

**此項測試驗證 v1.1.0 的 bug 修復。**

##### 2.4 多語言測試

**測試步驟：**
1. 依序測試以下語言：
   - 越南語（vi）
   - 印尼語（id）
   - 菲律賓語（tl）
   - 英文（en）
   - 義大利語（it）
   - 日文（ja）
   - 韓文（ko）
   - 泰文（th）
2. 每種語言說一句中文，檢查翻譯結果

**預期結果：**
- ✅ 所有語言都能正確翻譯
- ✅ TTS 語音使用正確的語言
- ✅ 對話記錄正確顯示語言代碼

##### 2.5 對話記錄功能

**測試步驟：**
1. 完成一段對話（至少 3 句）
2. 點擊「匯出對話記錄」按鈕
3. 檢查下載的 TXT 檔案內容
4. 點擊「清除對話記錄」按鈕
5. 檢查對話記錄是否清空

**預期結果：**
- ✅ TXT 檔案包含所有對話內容
- ✅ 格式正確（時間、說話者、原文、譯文）
- ✅ 清除後對話記錄為空

##### 2.6 後端切換功能

**測試步驟：**
1. 切換到「Go 後端」
2. 執行基本翻譯測試
3. 切換到「Hybrid ASR」
4. 執行基本翻譯測試
5. 切換回「Node.js 後端」

**預期結果：**
- ✅ 所有後端都能正常運作
- ✅ 切換後端不影響對話記錄
- ✅ Hybrid ASR 延遲更低（< 2 秒）

##### 2.7 錯誤處理測試

**測試步驟：**
1. 關閉麥克風權限
2. 點擊「開始對話」按鈕
3. 檢查錯誤訊息
4. 說話時間過長（> 4 秒）
5. 檢查是否自動分段

**預期結果：**
- ✅ 顯示友善的錯誤訊息
- ✅ 超過 4 秒自動分段
- ✅ 不會崩潰或卡住

---

## 效能測試

### 延遲測試

#### 執行延遲測試

```bash
pnpm test server/translation.realtime.test.ts --run
```

#### 效能指標

測試會輸出以下指標：

- **ASR 延遲：** Whisper API 語音識別時間
- **翻譯延遲：** GPT 翻譯時間
- **TTS 延遲：** TTS 語音合成時間
- **E2E 延遲：** 端到端總延遲

#### 效能目標

| 指標 | 目標 | 當前 | 狀態 |
|------|------|------|------|
| ASR 延遲 | < 2 秒 | 2.5-3.5 秒 | 🟡 需優化 |
| 翻譯延遲 | < 1 秒 | 0.8-1.3 秒 | ✅ 達標 |
| TTS 延遲 | < 1 秒 | < 1 秒 | ✅ 達標 |
| E2E 延遲 | < 3 秒 | 3.9 秒 | 🟡 需優化 |

### 負載測試

#### 連續翻譯測試

測試系統處理連續翻譯的能力：

```bash
pnpm test -t "should handle rapid consecutive translations" --run
```

此測試會模擬連續 5 次翻譯請求，檢查系統是否能穩定處理。

#### 預期結果

- ✅ 所有翻譯都能成功完成
- ✅ 延遲不會隨著請求增加而增加
- ✅ 沒有記憶體洩漏

---

## 測試報告

### 產生測試報告

執行測試後，系統會自動產生測試報告：

```bash
pnpm test --run 2>&1 | tee test-results.log
```

測試報告會儲存在 `test-results.log`。

### 測試報告內容

測試報告包含以下資訊：

1. **測試摘要**
   - 總測試數
   - 通過/失敗/跳過數量
   - 通過率
   - 執行時間

2. **失敗測試詳情**
   - 測試名稱
   - 錯誤訊息
   - 堆疊追蹤
   - 失敗原因分析

3. **效能指標**
   - 平均延遲
   - 最小/最大延遲
   - 瓶頸分析

4. **測試覆蓋範圍**
   - 已測試功能列表
   - 未測試功能列表

### 查看最新測試報告

```bash
cat /home/ubuntu/realtime-translation/TEST_REPORT.md
```

---

## 持續整合

### CI/CD 流程（未來規劃）

#### 1. 提交前檢查

```bash
# 執行 linting
pnpm lint

# 執行類型檢查
pnpm typecheck

# 執行單元測試
pnpm test --run
```

#### 2. Pull Request 檢查

- 所有單元測試必須通過
- 程式碼覆蓋率 > 80%
- 沒有 TypeScript 錯誤
- 沒有 ESLint 錯誤

#### 3. 部署前檢查

- 所有測試通過（包括整合測試）
- 效能測試達標
- 手動 UI 測試通過
- 建立 checkpoint

#### 4. 部署後驗證

- 健康檢查（Health Check）
- 煙霧測試（Smoke Test）
- 監控告警設定

---

## 測試最佳實踐

### 1. 測試隔離

每個測試應該是獨立的，不依賴其他測試的結果。

**好的做法：**
```typescript
describe("Translation API", () => {
  beforeEach(() => {
    // 每個測試前重置狀態
    resetDatabase();
  });

  it("should translate Chinese to Vietnamese", async () => {
    // 測試邏輯
  });
});
```

### 2. 使用 Mock

對於外部 API 呼叫，應該使用 mock 來避免實際呼叫。

**範例：**
```typescript
vi.mock("openai", () => ({
  OpenAI: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: "你好",
          language: "zh",
        }),
      },
    },
  })),
}));
```

### 3. 測試命名

測試名稱應該清楚描述測試內容。

**好的命名：**
```typescript
it("should return 400 when audio buffer is empty", async () => {
  // 測試邏輯
});
```

**不好的命名：**
```typescript
it("test 1", async () => {
  // 測試邏輯
});
```

### 4. 測試覆蓋範圍

- 正常情況（Happy Path）
- 邊界情況（Edge Cases）
- 錯誤情況（Error Cases）

**範例：**
```typescript
describe("autoTranslate", () => {
  it("should handle normal audio input", async () => {});
  it("should handle empty audio buffer", async () => {});
  it("should handle very long audio (> 10 seconds)", async () => {});
  it("should handle invalid audio format", async () => {});
});
```

### 5. 測試資料管理

使用工廠函數或 fixtures 來產生測試資料。

**範例：**
```typescript
function createTestUser() {
  return {
    id: 1,
    openId: "test-user",
    name: "Test User",
    email: "test@example.com",
    role: "user",
  };
}
```

---

## 常見問題

### Q1: 測試執行很慢怎麼辦？

**A:** 可以使用以下方法加速測試：

1. 只執行特定測試檔案
2. 使用 mock 避免實際 API 呼叫
3. 使用 `--run` 參數避免監視模式
4. 平行執行測試（Vitest 預設支援）

### Q2: 測試失敗但本地環境正常？

**A:** 可能的原因：

1. 環境變數設定不同
2. 資料庫狀態不一致
3. 時區問題
4. 相依套件版本不同

**解決方法：**
- 檢查 `.env` 檔案
- 重置資料庫（`pnpm db:push`）
- 清除 node_modules 並重新安裝

### Q3: 如何除錯測試？

**A:** 使用以下方法：

1. **加入 console.log**
   ```typescript
   it("should work", () => {
     console.log("Debug info:", data);
     expect(data).toBeDefined();
   });
   ```

2. **使用 Vitest UI**
   ```bash
   pnpm test --ui
   ```

3. **使用 VS Code 除錯器**
   - 在測試檔案中設定中斷點
   - 按 F5 開始除錯

---

## 聯絡資訊

如有測試相關問題，請參考：

- **測試報告：** `/home/ubuntu/realtime-translation/TEST_REPORT.md`
- **版本歷史：** `/home/ubuntu/realtime-translation/VERSION_HISTORY.md`
- **開發時程：** `/home/ubuntu/realtime-translation/DEVELOPMENT_SCHEDULE.md`
