# 自動化文件檢查機制設計

**文件版本**：v1.0  
**建立日期**：2025-12-27  
**作者**：Manus AI  
**目的**：設計 CI/CD 自動驗證方案，確保文件與實作持續一致

---

## 📋 設計目標

本設計旨在建立一套自動化機制，在每次程式碼變更時自動檢查文件與實作的一致性，避免文件過時或不一致的問題。設計遵循以下原則：

**可行性優先**：優先選擇易於實作且維護成本低的方案，避免過度工程化。所有檢查項目應能在標準 CI/CD 環境（GitHub Actions）中執行，無需額外基礎設施。

**漸進式實作**：將檢查項目分為三個優先級（P0/P1/P2），允許團隊根據資源逐步實作。P0 項目為必須實作的基礎檢查，P1 項目為建議實作的進階檢查，P2 項目為未來優化方向。

**開發者友善**：檢查失敗時應提供清晰的錯誤訊息與修正建議，避免阻礙開發流程。檢查應在本地開發環境中也能執行，方便開發者在提交前自我驗證。

---

## 🎯 檢查範圍

### 可自動驗證的項目

根據 **DOCUMENTATION_CONSISTENCY_AUDIT.md** 的發現，以下項目可透過自動化檢查驗證：

#### 1. 模型名稱一致性（Critical）

**檢查目標**：確保文件中引用的模型名稱與 `shared/config.ts` 中定義的模型名稱一致。

**驗證方式**：
- 從 `shared/config.ts` 提取所有模型名稱（ASR 模型、翻譯模型）
- 掃描所有 Markdown 文件，提取模型名稱引用
- 比對文件引用與實際定義，標記不一致項目

**可檢測的不一致**：
- 使用已棄用的模型名稱（如 `gpt-4o-audio-preview`）
- 使用不存在的模型名稱
- 預設值與實作不符

#### 2. 配置參數一致性（High）

**檢查目標**：確保文件中描述的配置參數與實際程式碼一致。

**驗證方式**：
- 從 `shared/config.ts` 提取所有配置常數（VAD 參數、ASR 參數、翻譯參數）
- 掃描文件中的參數表格與說明
- 比對預設值、可選值、資料型別

**可檢測的不一致**：
- 預設值錯誤
- 可選值範圍錯誤
- 資料型別錯誤
- 參數名稱拼寫錯誤

#### 3. 檔案路徑一致性（Medium）

**檢查目標**：確保文件中引用的檔案路徑存在且正確。

**驗證方式**：
- 掃描文件中的檔案路徑引用（如 `shared/config.ts`, `client/src/pages/Home.tsx`）
- 驗證檔案是否存在
- 驗證行號引用是否有效（如果有）

**可檢測的不一致**：
- 引用不存在的檔案
- 引用已移動的檔案
- 行號引用過時

#### 4. 狀態機定義一致性（High）

**檢查目標**：確保文件中描述的狀態機與程式碼實作一致。

**驗證方式**：
- 從程式碼提取狀態機定義（enum, type, const）
- 掃描文件中的狀態機圖與說明
- 比對狀態名稱、轉換條件

**可檢測的不一致**：
- 狀態名稱不一致
- 缺少新增的狀態
- 引用已移除的狀態

#### 5. API 介面一致性（Medium）

**檢查目標**：確保文件中描述的 API 介面與實際實作一致。

**驗證方式**：
- 從 `server/routers.ts` 提取 tRPC procedures
- 掃描文件中的 API 說明
- 比對 procedure 名稱、參數、回傳型別

**可檢測的不一致**：
- Procedure 名稱錯誤
- 參數名稱或型別錯誤
- 回傳型別錯誤

---

## 🏗️ 架構設計

### 整體架構

```
┌─────────────────────────────────────────────────────────────┐
│                        CI/CD Pipeline                        │
│                      (GitHub Actions)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Documentation Check Script                  │
│                  (scripts/doc-check.ts)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  Config Extractor│ │ Doc Scanner  │ │ Code Analyzer│
│  (config.ts)     │ │ (*.md files) │ │ (*.ts files) │
└──────────────────┘ └──────────────┘ └──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Consistency Checker                     │
│              (Compare & Generate Report)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Check Report                            │
│              (Pass / Fail + Fix Suggestions)                 │
└─────────────────────────────────────────────────────────────┘
```

### 核心模組

#### 1. Config Extractor（配置提取器）

**職責**：從 `shared/config.ts` 提取所有配置定義。

**輸出格式**：
```typescript
interface ExtractedConfig {
  asrModels: Array<{
    value: string;
    label: string;
    description: string;
  }>;
  translationModels: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  vadParams: Record<string, {
    value: any;
    type: string;
    description: string;
  }>;
  asrParams: Record<string, any>;
  translationParams: Record<string, any>;
}
```

**實作方式**：
- 使用 TypeScript Compiler API 解析 `shared/config.ts`
- 提取所有 export const 定義
- 解析物件結構與型別

#### 2. Doc Scanner（文件掃描器）

**職責**：掃描所有 Markdown 文件，提取結構化資訊。

**輸出格式**：
```typescript
interface ScannedDoc {
  filePath: string;
  modelReferences: Array<{
    line: number;
    modelName: string;
    context: string;
  }>;
  paramTables: Array<{
    line: number;
    params: Record<string, {
      type: string;
      defaultValue: string;
      description: string;
    }>;
  }>;
  filePathReferences: Array<{
    line: number;
    path: string;
    lineNumber?: number;
  }>;
  stateReferences: Array<{
    line: number;
    stateName: string;
    context: string;
  }>;
}
```

**實作方式**：
- 使用 `remark` 或 `unified` 解析 Markdown AST
- 使用正則表達式提取特定模式（模型名稱、檔案路徑）
- 解析表格結構

#### 3. Code Analyzer（程式碼分析器）

**職責**：分析 TypeScript 程式碼，提取狀態機、API 介面定義。

**輸出格式**：
```typescript
interface AnalyzedCode {
  stateMachines: Array<{
    name: string;
    states: string[];
    transitions: Array<{
      from: string;
      to: string;
      condition?: string;
    }>;
  }>;
  trpcProcedures: Array<{
    name: string;
    type: 'query' | 'mutation';
    input?: TypeDefinition;
    output?: TypeDefinition;
  }>;
}
```

**實作方式**：
- 使用 TypeScript Compiler API 解析程式碼
- 提取 enum, type, interface 定義
- 提取 tRPC router 定義

#### 4. Consistency Checker（一致性檢查器）

**職責**：比對提取的資訊，產生檢查報告。

**檢查邏輯**：
```typescript
function checkModelConsistency(
  extractedConfig: ExtractedConfig,
  scannedDocs: ScannedDoc[]
): CheckResult[] {
  const results: CheckResult[] = [];
  const validModels = new Set([
    ...extractedConfig.asrModels.map(m => m.value),
    ...extractedConfig.translationModels.map(m => m.id)
  ]);

  for (const doc of scannedDocs) {
    for (const ref of doc.modelReferences) {
      if (!validModels.has(ref.modelName)) {
        results.push({
          severity: 'error',
          file: doc.filePath,
          line: ref.line,
          message: `Invalid model name: ${ref.modelName}`,
          suggestion: `Valid models: ${Array.from(validModels).join(', ')}`
        });
      }
    }
  }

  return results;
}
```

---

## 🔧 實作方案

### Phase 1: 基礎檢查（P0 - 必須實作）

#### 1.1 模型名稱檢查

**實作檔案**：`scripts/doc-check/check-models.ts`

**檢查流程**：
1. 從 `shared/config.ts` 提取 `WHISPER_CONFIG.AVAILABLE_MODELS` 和 `TRANSLATION_CONFIG.AVAILABLE_TRANSLATION_MODELS`
2. 掃描所有 `.md` 檔案，使用正則表達式提取模型名稱引用
3. 比對引用與定義，產生錯誤報告

**正則表達式模式**：
```typescript
const MODEL_PATTERNS = [
  /`(whisper-1|gpt-4o-[a-z-]+)`/g,           // Inline code
  /\|\s*`([^`]+)`\s*\|/g,                     // Table cells
  /model:\s*"([^"]+)"/g,                      // Code blocks
];
```

**錯誤訊息範例**：
```
❌ docs/realtime-subtitle-translation-spec.md:534
   Invalid ASR model: "gpt-4o-audio-preview"
   
   Valid models:
   - whisper-1
   - gpt-4o-mini-transcribe
   - gpt-4o-transcribe
   - gpt-4o-transcribe-diarize
   
   Suggestion: Replace with "gpt-4o-mini-transcribe"
```

#### 1.2 配置參數檢查

**實作檔案**：`scripts/doc-check/check-config.ts`

**檢查流程**：
1. 從 `shared/config.ts` 提取所有配置常數
2. 掃描文件中的參數表格（使用 Markdown AST）
3. 比對預設值、型別、可選值

**表格解析範例**：
```typescript
interface ParamTable {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
  validValues?: string;
}

function parseParamTable(tableNode: MdastTable): ParamTable[] {
  // Parse Markdown table AST
  // Extract param definitions
  // Return structured data
}
```

**錯誤訊息範例**：
```
❌ docs/realtime-subtitle-translation-spec.md:556
   Parameter "model" default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Suggestion: Update table cell to "gpt-4.1-mini"
```

#### 1.3 檔案路徑檢查

**實作檔案**：`scripts/doc-check/check-paths.ts`

**檢查流程**：
1. 掃描文件中的檔案路徑引用（使用正則表達式）
2. 驗證檔案是否存在（使用 `fs.existsSync`）
3. 如果有行號引用，驗證行號是否有效

**正則表達式模式**：
```typescript
const PATH_PATTERNS = [
  /`([a-zA-Z0-9_\-\/\.]+\.ts)`/g,            // TypeScript files
  /`([a-zA-Z0-9_\-\/\.]+\.tsx)`/g,           // React files
  /line\s+(\d+)/gi,                          // Line numbers
];
```

**錯誤訊息範例**：
```
❌ docs/ai/ManusAI_SystemPrompt_Engineering.md:273
   File path does not exist: "shared/config.ts line 205"
   
   File exists: ✅
   Line 205 exists: ❌ (File has only 180 lines)
   
   Suggestion: Update line number or check if code moved
```

### Phase 2: 進階檢查（P1 - 建議實作）

#### 2.1 狀態機一致性檢查

**實作檔案**：`scripts/doc-check/check-state-machines.ts`

**檢查流程**：
1. 使用 TypeScript Compiler API 提取狀態機定義（enum, type）
2. 掃描文件中的狀態機圖（Mermaid 格式）
3. 比對狀態名稱與轉換

**TypeScript AST 解析範例**：
```typescript
import * as ts from 'typescript';

function extractStateMachine(sourceFile: ts.SourceFile): StateMachine {
  const states: string[] = [];
  
  ts.forEachChild(sourceFile, node => {
    if (ts.isEnumDeclaration(node)) {
      node.members.forEach(member => {
        states.push(member.name.getText());
      });
    }
  });
  
  return { name: 'SegmentState', states };
}
```

**Mermaid 圖解析範例**：
```typescript
function parseMermaidStateDiagram(mermaidCode: string): StateMachine {
  const statePattern = /state\s+"([^"]+)"/g;
  const transitionPattern = /(\w+)\s*-->\s*(\w+)/g;
  
  const states = [...mermaidCode.matchAll(statePattern)].map(m => m[1]);
  const transitions = [...mermaidCode.matchAll(transitionPattern)].map(m => ({
    from: m[1],
    to: m[2]
  }));
  
  return { states, transitions };
}
```

**錯誤訊息範例**：
```
❌ docs/realtime-subtitle-translation-spec.md:890
   State machine mismatch in Mermaid diagram
   
   Code defines states: IDLE, SPEAKING, ENDING, FINALIZING, DONE, CANCELLED
   Diagram shows states: IDLE, SPEAKING, ENDING, FINALIZING, DONE
   
   Missing in diagram: CANCELLED
   
   Suggestion: Add CANCELLED state to Mermaid diagram
```

#### 2.2 API 介面一致性檢查

**實作檔案**：`scripts/doc-check/check-api.ts`

**檢查流程**：
1. 使用 TypeScript Compiler API 提取 tRPC procedures
2. 掃描文件中的 API 說明
3. 比對 procedure 名稱、參數、回傳型別

**tRPC Router 解析範例**：
```typescript
function extractTRPCProcedures(routerFile: string): Procedure[] {
  const sourceFile = ts.createSourceFile(
    routerFile,
    fs.readFileSync(routerFile, 'utf-8'),
    ts.ScriptTarget.Latest
  );
  
  const procedures: Procedure[] = [];
  
  // Parse router definition
  // Extract query/mutation procedures
  // Extract input/output types
  
  return procedures;
}
```

**錯誤訊息範例**：
```
❌ docs/ARCHITECTURE-v2.0.md:456
   API procedure signature mismatch
   
   Code: trpc.translate.qualityPass.useMutation()
   Input: { messageId: number, conversationContext: ConversationContext }
   Output: { success: boolean, updatedMessage: ConversationMessage }
   
   Doc shows: Input: { messageId: string }
   
   Suggestion: Update input type to "number"
```

### Phase 3: 未來優化（P2 - 長期目標）

#### 3.1 語義一致性檢查

**目標**：使用 LLM 檢查文件描述與程式碼行為的語義一致性。

**實作方式**：
- 提取程式碼邏輯與文件描述
- 使用 LLM（如 GPT-4）比對語義
- 標記可能的不一致

**挑戰**：
- 需要 LLM API 成本
- 檢查速度較慢
- 誤報率較高

#### 3.2 自動修正建議

**目標**：自動產生修正 PR，而非只報告錯誤。

**實作方式**：
- 檢查失敗時自動產生修正後的文件
- 建立 GitHub PR
- 標記為 "documentation-sync"

**挑戰**：
- 需要 GitHub API 整合
- 需要處理衝突
- 需要人工審核

#### 3.3 即時檢查（IDE 整合）

**目標**：在編輯器中即時顯示文件一致性問題。

**實作方式**：
- 開發 VS Code 擴充套件
- 在編輯 Markdown 時即時檢查
- 顯示 inline diagnostics

**挑戰**：
- 需要維護擴充套件
- 需要處理效能問題
- 需要支援多種編輯器

---

## 🚀 CI/CD 整合

### GitHub Actions Workflow

**檔案位置**：`.github/workflows/check-docs.yml`

```yaml
name: Documentation Consistency Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  # 只在相關檔案變更時執行
  paths:
    - 'shared/config.ts'
    - 'server/routers.ts'
    - 'docs/**/*.md'
    - '*.md'
    - 'scripts/doc-check/**'

jobs:
  check-docs:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install -g pnpm
          pnpm install
      
      - name: Run documentation checks
        run: pnpm run check:docs
      
      - name: Upload check report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: doc-check-report
          path: docs/check-report.md
      
      - name: Comment on PR
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('docs/check-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 📋 Documentation Consistency Check Failed\n\n${report}`
            });
```

### 本地檢查腳本

**檔案位置**：`scripts/doc-check.sh`

```bash
#!/bin/bash

echo "🔍 Running documentation consistency checks..."

# Run all checks
pnpm tsx scripts/doc-check/check-models.ts
pnpm tsx scripts/doc-check/check-config.ts
pnpm tsx scripts/doc-check/check-paths.ts

# Optional: Run advanced checks if available
if [ -f "scripts/doc-check/check-state-machines.ts" ]; then
  pnpm tsx scripts/doc-check/check-state-machines.ts
fi

if [ -f "scripts/doc-check/check-api.ts" ]; then
  pnpm tsx scripts/doc-check/check-api.ts
fi

echo "✅ All checks completed"
```

**使用方式**：
```bash
# 執行所有檢查
pnpm run check:docs

# 執行特定檢查
pnpm tsx scripts/doc-check/check-models.ts

# 自動修正（如果支援）
pnpm run check:docs --fix
```

### package.json 腳本

```json
{
  "scripts": {
    "check:docs": "bash scripts/doc-check.sh",
    "check:docs:models": "tsx scripts/doc-check/check-models.ts",
    "check:docs:params": "tsx scripts/doc-check/check-config.ts",
    "check:docs:paths": "tsx scripts/doc-check/check-paths.ts",
    "check:docs:all": "tsx scripts/doc-check/index.ts"
  }
}
```

---

## 📊 檢查報告格式

### 標準輸出格式

```
🔍 Documentation Consistency Check Report
Generated: 2025-12-27 10:30:00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total files checked: 31
Total issues found: 5
  - Critical: 2
  - High: 1
  - Medium: 2
  - Low: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 Critical Issues (2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. docs/realtime-subtitle-translation-spec.md:534
   Invalid ASR model: "gpt-4o-audio-preview"
   
   Expected: One of [whisper-1, gpt-4o-mini-transcribe, 
                     gpt-4o-transcribe, gpt-4o-transcribe-diarize]
   Found:    "gpt-4o-audio-preview"
   
   Fix: Replace with "gpt-4o-mini-transcribe"

2. docs/realtime-subtitle-translation-spec.md:556
   Parameter default value mismatch
   
   Expected: "gpt-4.1-mini" (from shared/config.ts:205)
   Found:    "gpt-4o-mini"
   
   Fix: Update table cell to "gpt-4.1-mini"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 High Priority Issues (1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. docs/ARCHITECTURE-v2.0.md:456
   API procedure signature mismatch
   
   Code: trpc.translate.qualityPass.useMutation()
   Input: { messageId: number, conversationContext: ConversationContext }
   
   Doc shows: Input: { messageId: string }
   
   Fix: Update input type to "number"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔵 Medium Priority Issues (2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. docs/ai/ManusAI_SystemPrompt_Engineering.md:273
   Line number reference out of range
   
   File: shared/config.ts
   Referenced line: 205
   Actual file length: 180 lines
   
   Fix: Update line number or check if code moved

5. README.md:45
   File path does not exist: "docs/API_REFERENCE.md"
   
   Fix: Create missing file or remove reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check Type          | Issues | Pass Rate
--------------------|--------|----------
Model Names         |      2 |      93%
Config Parameters   |      1 |      97%
File Paths          |      2 |      95%
State Machines      |      0 |     100%
API Interfaces      |      0 |     100%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Check failed with 5 issues
```

### Markdown 報告格式

**檔案位置**：`docs/check-report.md`

```markdown
# Documentation Consistency Check Report

**Generated**: 2025-12-27 10:30:00  
**Status**: ❌ Failed (5 issues)

## Summary

| Metric | Value |
|--------|-------|
| Total files checked | 31 |
| Total issues found | 5 |
| Critical issues | 2 |
| High priority issues | 1 |
| Medium priority issues | 2 |
| Low priority issues | 0 |

## Critical Issues

### 1. Invalid ASR model name

**File**: `docs/realtime-subtitle-translation-spec.md:534`  
**Severity**: 🔴 Critical

**Problem**: Document references deprecated model "gpt-4o-audio-preview"

**Expected**: One of `whisper-1`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize`

**Fix**: Replace with `gpt-4o-mini-transcribe`

---

[... more issues ...]

## Statistics

### Check Type Breakdown

| Check Type | Issues | Pass Rate |
|------------|--------|-----------|
| Model Names | 2 | 93% |
| Config Parameters | 1 | 97% |
| File Paths | 2 | 95% |
| State Machines | 0 | 100% |
| API Interfaces | 0 | 100% |

### Files with Issues

| File | Issues |
|------|--------|
| docs/realtime-subtitle-translation-spec.md | 2 |
| docs/ARCHITECTURE-v2.0.md | 1 |
| docs/ai/ManusAI_SystemPrompt_Engineering.md | 1 |
| README.md | 1 |
```

---

## 🎯 實作優先級

### P0 - 必須實作（2-3 天）

| 項目 | 工作量 | 優先級 | 說明 |
|------|--------|--------|------|
| 模型名稱檢查 | 4 小時 | P0 | 最常見的不一致問題 |
| 配置參數檢查 | 6 小時 | P0 | 預設值經常變更 |
| 檔案路徑檢查 | 3 小時 | P0 | 容易實作且價值高 |
| GitHub Actions 整合 | 2 小時 | P0 | 自動化執行 |
| 本地檢查腳本 | 1 小時 | P0 | 開發者體驗 |

**總工作量**：約 16 小時（2 個工作天）

### P1 - 建議實作（1-2 週）

| 項目 | 工作量 | 優先級 | 說明 |
|------|--------|--------|------|
| 狀態機一致性檢查 | 12 小時 | P1 | 需要 TypeScript AST 解析 |
| API 介面一致性檢查 | 10 小時 | P1 | 需要 tRPC 特定解析 |
| Mermaid 圖解析 | 8 小時 | P1 | 需要圖形語法解析 |
| 錯誤訊息優化 | 4 小時 | P1 | 提升開發者體驗 |

**總工作量**：約 34 小時（4-5 個工作天）

### P2 - 未來優化（長期）

| 項目 | 工作量 | 優先級 | 說明 |
|------|--------|--------|------|
| 語義一致性檢查 | 20 小時 | P2 | 需要 LLM 整合 |
| 自動修正 PR | 16 小時 | P2 | 需要 GitHub API |
| IDE 整合 | 40 小時 | P2 | 需要擴充套件開發 |

**總工作量**：約 76 小時（9-10 個工作天）

---

## 🔄 維護計畫

### 定期更新

**每月檢查**：
- 檢查新增的配置參數是否加入檢查清單
- 檢查新增的文件是否加入掃描範圍
- 更新正則表達式模式（如有新的命名慣例）

**每季檢查**：
- 檢視檢查報告統計，識別常見問題
- 優化檢查邏輯，降低誤報率
- 評估是否需要新增檢查項目

### 持續改進

**監控指標**：
- 檢查執行時間（目標：< 30 秒）
- 誤報率（目標：< 5%）
- 開發者滿意度（透過問卷調查）

**改進方向**：
- 根據誤報案例優化檢查邏輯
- 根據開發者回饋改進錯誤訊息
- 根據執行時間優化效能

---

## 📚 參考資料

### 相關工具與函式庫

| 工具 | 用途 | 連結 |
|------|------|------|
| TypeScript Compiler API | 解析 TypeScript 程式碼 | [官方文件](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) |
| remark | 解析 Markdown AST | [官方網站](https://remark.js.org/) |
| unified | 統一處理語法樹 | [官方網站](https://unifiedjs.com/) |
| gray-matter | 解析 Markdown frontmatter | [GitHub](https://github.com/jonschlinkert/gray-matter) |
| ts-morph | TypeScript AST 操作 | [官方文件](https://ts-morph.com/) |

### 類似專案參考

| 專案 | 說明 |
|------|------|
| [Vale](https://vale.sh/) | 文件風格檢查工具 |
| [markdownlint](https://github.com/DavidAnson/markdownlint) | Markdown 語法檢查 |
| [TypeDoc](https://typedoc.org/) | TypeScript 文件生成 |
| [API Extractor](https://api-extractor.com/) | API 文件提取 |

---

## ✅ 結論

本設計提供了一套完整的自動化文件檢查機制，能夠有效防止文件與實作不一致的問題。透過分階段實作（P0/P1/P2），團隊可以根據資源逐步建立檢查能力。

**關鍵成功因素**：
1. **開發者友善**：清晰的錯誤訊息與修正建議
2. **快速執行**：檢查時間控制在 30 秒內
3. **低誤報率**：避免過多 false positive 干擾開發
4. **易於維護**：模組化設計，易於擴充與更新

**建議執行順序**：
1. 先實作 P0 項目（模型名稱、配置參數、檔案路徑檢查）
2. 整合到 GitHub Actions，確保每次 PR 都會執行
3. 收集開發者回饋，優化錯誤訊息
4. 根據需求逐步實作 P1 項目（狀態機、API 檢查）
5. 長期考慮 P2 項目（語義檢查、自動修正、IDE 整合）

---

**文件結束**
