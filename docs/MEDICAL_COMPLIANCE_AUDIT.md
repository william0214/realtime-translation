# 醫療產品合規性診斷報告

**診斷日期**: 2025-12-25  
**產品**: 即時雙向翻譯系統（醫療現場用）  
**Demo 時間**: 2026 年 3 月  
**診斷工程師**: Senior Full-Stack Engineer

---

## 🚨 嚴重問題（Critical Issues）

### 1. ❌ 缺少 shouldRunQualityPass() 成本控制機制

**問題描述**:
- 目前**所有句子**都會執行 Quality Pass（gpt-4o，來自 `shared/config.ts` SSOT）
- 短句（「好」、「謝謝」、「嘔」）也會觸發 Quality Pass
- 成本浪費：每句話 2 次 API 呼叫（Fast Pass: gpt-4.1-mini + Quality Pass: gpt-4o）

**風險等級**: 🔴 Critical  
**影響**: 成本失控、延遲增加、醫院 demo 時可能因成本過高被質疑

**程式碼位置**: `client/src/pages/Home.tsx` line 807-918

**現況**:
```typescript
// Step 2: 兩段式翻譯（Fast Pass + Quality Pass）
if (result.translatedText) {
  // 🔥 所有句子都會執行 Quality Pass，沒有任何過濾
  const provisionalMessage = { ... };
  setConversations((prev) => [...prev, provisionalMessage]);
  
  // 非阻塞執行 Quality Pass（無條件執行）
  (async () => {
    const qualityResult = await qualityPassMutation.mutateAsync({ ... });
  })();
}
```

**應有邏輯**:
```typescript
// 只有符合條件的句子才執行 Quality Pass
if (result.translatedText && shouldRunQualityPass(result.sourceText, result.sourceLang)) {
  // 執行 Quality Pass
} else {
  // 直接使用 Fast Pass 結果，不執行 Quality Pass
}
```

---

### 2. ❌ Race Condition 防護不完整

**問題描述**:
- Quality Pass 是非阻塞執行（async IIFE）
- 回填時只檢查 `provisionalMessageId`，沒有檢查：
  - `conversationId`（對話是否已結束）
  - `version` 或 `timestamp`（訊息是否已被更新）
  - 延遲超時（15-20 秒）
- 可能導致：
  - 對話結束後仍更新 UI
  - 舊的 Quality Pass 結果覆蓋新的翻譯
  - 延遲過久的回填造成使用者困惑

**風險等級**: 🔴 Critical  
**影響**: UI 混亂、不可解釋行為、醫療人員失去信任

**程式碼位置**: `client/src/pages/Home.tsx` line 869-884

**現況**:
```typescript
if (qualityResult.success) {
  // 🔥 只檢查 provisionalMessageId，沒有其他防護
  setConversations((prev) =>
    prev.map((msg) =>
      msg.id === provisionalMessageId
        ? {
            ...msg,
            translatedText: finalTranslation,
            translationStage: "final" as const,
            qualityPassStatus: "completed" as const,
          }
        : msg
    )
  );
}
```

**應有邏輯**:
```typescript
// 1. 檢查 conversation 是否已結束
if (!currentConversationId || currentConversationId !== originalConversationId) {
  console.log(`[Quality Pass] Conversation ended, discarding result`);
  return;
}

// 2. 檢查 message 是否仍存在且未被更新
const targetMessage = conversations.find(msg => msg.id === provisionalMessageId);
if (!targetMessage || targetMessage.translationStage === "final") {
  console.log(`[Quality Pass] Message not found or already finalized, discarding result`);
  return;
}

// 3. 檢查延遲是否超時（15-20 秒）
const elapsedTime = Date.now() - startTime;
if (elapsedTime > 20000) {
  console.log(`[Quality Pass] Timeout (${elapsedTime}ms > 20000ms), discarding result`);
  return;
}

// 4. 更新 UI
setConversations((prev) => prev.map(msg => ...));
```

---

### 3. ❌ 狀態機違反：可能產生第二顆 bubble

**問題描述**:
- Fast Pass 翻譯結果會**新增一顆 bubble**（line 823）
- 如果 Quality Pass 失敗，這顆 bubble 會永久保留
- 違反「每句話只能有一顆 bubble」的原則

**風險等級**: 🔴 Critical  
**影響**: UI 混亂、訊息重複、醫療人員無法理解哪個是正確翻譯

**程式碼位置**: `client/src/pages/Home.tsx` line 809-824

**現況**:
```typescript
// 🔥 Step 2.1: 立即顯示 Fast Pass 翻譯（provisional）
const provisionalMessageId = messageIdRef.current++;
const provisionalMessage: ConversationMessage = {
  id: provisionalMessageId,
  speaker: sourceSpeaker,
  originalText: result.sourceText,
  translatedText: result.translatedText, // Fast Pass 翻譯結果
  // ...
};
setConversations((prev) => [...prev, provisionalMessage]); // 🔥 新增一顆 bubble
```

**問題分析**:
1. 原文 bubble（line 802）
2. Fast Pass 翻譯 bubble（line 823）
3. 如果 Quality Pass 成功，更新 bubble #2
4. 如果 Quality Pass 失敗，bubble #2 永久保留（標記為 failed）

**正確邏輯**:
- 應該在**原文 bubble 內**顯示翻譯（同一顆 bubble）
- 或者使用 `translatedMessage` 欄位，而非新增 bubble

---

### 4. ⚠️ 缺少醫療術語一致性機制

**問題描述**:
- 目前沒有 `terminology_map`（醫療術語字典）
- 雖然有 `shared/glossary.ts`，但沒有在 Quality Pass prompt 中強制使用
- Fast Pass 和 Quality Pass 可能產生不同的術語翻譯

**風險等級**: 🟡 High  
**影響**: 術語不一致、醫療人員困惑、可能誤導診斷

**程式碼位置**: `server/twoPassTranslation.ts`

**現況**:
- `shared/glossary.ts` 有 47 個醫療術語
- `shared/translationPrompts.ts` 的 Quality Pass prompt 有提到 glossary
- 但沒有在實際呼叫時**強制注入 glossary**

**應有邏輯**:
```typescript
// Quality Pass prompt 應該包含：
const glossaryText = Object.entries(MEDICAL_GLOSSARY)
  .filter(([_, term]) => term.targetLang === targetLang)
  .map(([key, term]) => `${term.source} → ${term.target}`)
  .join("\n");

const prompt = `
${QUALITY_PASS_PROMPT}

**醫療術語對照表（必須使用）**:
${glossaryText}
`;
```

---

### 5. ⚠️ 缺少「不確定」的處理邏輯

**問題描述**:
- 目前沒有「不確定」的標記機制
- 如果 Whisper 識別不清楚，仍然會強制翻譯
- 違反醫療產品倫理：「不確定 → 保留原意」

**風險等級**: 🟡 High  
**影響**: 可能誤導醫療人員、產生錯誤診斷

**應有邏輯**:
```typescript
// Whisper 回傳 confidence score（如果有）
if (result.confidence && result.confidence < 0.7) {
  // 標記為「不確定」，不翻譯
  return {
    sourceText: result.sourceText,
    translatedText: "[不確定]",
    confidence: result.confidence,
    uncertain: true,
  };
}
```

---

## ✅ 已正確實作的部分

### 1. ✅ Segment Guard 機制

**位置**: `client/src/pages/Home.tsx` line 466-478, 625-634, 745-754

**實作**:
```typescript
// 🔒 Segment guard: Check if segment is still active
if (cancelledSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ [Partial/Segment#${segmentId}] Segment cancelled, ignoring partial request`);
  return;
}

if (!activeSegmentsRef.current.has(segmentId)) {
  console.log(`⚠️ [Partial/Segment#${segmentId}] Segment not active, ignoring partial request`);
  return;
}
```

**評價**: ✅ 正確，可以防止已取消的 segment 更新 UI

---

### 2. ✅ Whisper 幻覺過濾

**位置**: `client/src/pages/Home.tsx` line 581-586, 761-773

**實作**:
```typescript
// 🔥 Filter Whisper hallucination (repeated strings)
const isHallucination = detectWhisperHallucination(result.sourceText);
if (isHallucination) {
  console.warn(`[Partial/Segment#${segmentId}] Whisper hallucination detected, skipping`);
  return;
}
```

**評價**: ✅ 正確，可以防止 Whisper 產生的垃圾輸出

---

### 3. ✅ VAD 雙門檻機制

**位置**: `client/src/pages/Home.tsx` line 428-462

**實作**:
```typescript
// Dual-threshold logic with consecutive frame counting
if (!currentlySpeaking) {
  if (rms > VAD_START_THRESHOLD) {
    vadStartFrameCountRef.current++;
    if (vadStartFrameCountRef.current >= VAD_START_FRAMES) {
      return true; // Speech started
    }
  }
} else {
  if (rms < VAD_END_THRESHOLD) {
    vadEndFrameCountRef.current++;
    if (vadEndFrameCountRef.current >= VAD_END_FRAMES) {
      return false; // Speech ended
    }
  }
}
```

**評價**: ✅ 正確，可以減少 VAD 抖動

---

## 📋 工程決策建議

### 優先級 P0（必須在 demo 前完成）

1. **實作 shouldRunQualityPass() 成本控制**
   - 預期工時：2-3 小時
   - 風險：成本失控
   - 建議：先實作簡單版本（長度 + 關鍵詞），後續再優化

2. **強化 Race Condition 防護**
   - 預期工時：3-4 小時
   - 風險：UI 混亂、不可解釋行為
   - 建議：加入 conversationId、version、timeout 檢查

3. **修正 UI bubble 邏輯（不新增第二顆 bubble）**
   - 預期工時：2-3 小時
   - 風險：UI 混亂、訊息重複
   - 建議：在原文 bubble 內顯示翻譯，或使用 `translatedMessage` 欄位

### 優先級 P1（demo 前建議完成）

4. **強制注入醫療術語字典到 Quality Pass**
   - 預期工時：1-2 小時
   - 風險：術語不一致
   - 建議：在 Quality Pass prompt 中強制注入 glossary

5. **實作「不確定」標記機制**
   - 預期工時：2-3 小時
   - 風險：可能誤導醫療人員
   - 建議：Whisper confidence < 0.7 時標記為「不確定」

### 優先級 P2（demo 後優化）

6. **UI 視覺回饋優化**
   - 預期工時：1-2 小時
   - 風險：使用者體驗
   - 建議：加入更明顯的 provisional → final 視覺變化

---

## 📊 風險評估

| 問題 | 風險等級 | 影響 | 優先級 |
|------|---------|------|--------|
| 缺少 shouldRunQualityPass() | 🔴 Critical | 成本失控 | P0 |
| Race Condition 防護不完整 | 🔴 Critical | UI 混亂 | P0 |
| 可能產生第二顆 bubble | 🔴 Critical | UI 混亂 | P0 |
| 缺少醫療術語一致性機制 | 🟡 High | 術語不一致 | P1 |
| 缺少「不確定」處理邏輯 | 🟡 High | 可能誤導 | P1 |

---

## 🎯 總結

目前系統的兩段式翻譯架構**已基本實作**，但有以下**嚴重問題**需要立即修正：

1. **成本控制缺失**：所有句子都執行 Quality Pass，成本失控
2. **Race Condition 防護不完整**：可能導致 UI 混亂
3. **UI bubble 邏輯錯誤**：可能產生第二顆 bubble

這些問題**必須在 demo 前修正**，否則會影響產品的**穩定性**和**可解釋性**。

建議優先處理 P0 問題（預計 7-10 小時工時），確保系統可以在醫院現場「活下來」。
