/**
 * 文件檢查工具 - 模型名稱檢查
 * 
 * 檢查文件中引用的模型名稱是否與 shared/config.ts 中定義的一致
 */

import * as path from "path";
import {
  CheckResult,
  CheckIssue,
  ModelDefinition,
} from "./types";
import {
  getProjectRoot,
  scanMarkdownFiles,
  readFile,
  findAllMatches,
  getLineNumber,
  getRelativePathFromRoot,
  extractTables,
  parseTable,
} from "./utils";

/**
 * 從 shared/config.ts 提取模型定義
 */
function extractModelDefinitions(configPath: string): ModelDefinition[] {
  const content = readFile(configPath);
  const models: ModelDefinition[] = [];
  
  // 提取 ASR 模型（從 ASR_MODELS 常數）
  const asrModelsMatch = content.match(/export const ASR_MODELS = \{([^}]+)\}/s);
  if (asrModelsMatch) {
    const asrModelsContent = asrModelsMatch[1];
    const modelMatches = findAllMatches(asrModelsContent, /"([^"]+)":/g);
    
    for (const match of modelMatches) {
      const modelName = match[1];
      models.push({
        name: modelName,
        type: "asr",
        description: `ASR model: ${modelName}`,
      });
    }
  }
  
  // 提取翻譯模型（從 TRANSLATION_MODELS 常數）
  const translationModelsMatch = content.match(/export const TRANSLATION_MODELS = \[([^\]]+)\]/s);
  if (translationModelsMatch) {
    const translationModelsContent = translationModelsMatch[1];
    const modelMatches = findAllMatches(translationModelsContent, /"([^"]+)"/g);
    
    for (const match of modelMatches) {
      const modelName = match[1];
      models.push({
        name: modelName,
        type: "translation",
        description: `Translation model: ${modelName}`,
      });
    }
  }
  
  return models;
}

/**
 * 從文件中提取模型引用
 */
function extractModelReferencesFromDoc(
  filePath: string,
  content: string,
  models: ModelDefinition[]
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const relPath = getRelativePathFromRoot(filePath);
  
  // 1. 檢查程式碼區塊中的模型引用
  const codeBlockPattern = /```[\w]*\s*\n([\s\S]*?)\n```/g;
  const codeBlocks = findAllMatches(content, codeBlockPattern);
  
  for (const match of codeBlocks) {
    const codeContent = match[1] || "";
    const codeStartPos = match.index || 0;
    
    // 尋找可能的模型名稱（引號包圍的字串）
    const stringPattern = /["']([^"']+)["']/g;
    const strings = findAllMatches(codeContent, stringPattern);
    
    for (const strMatch of strings) {
      const str = strMatch[1];
      const strPos = codeStartPos + (strMatch.index || 0);
      const line = getLineNumber(content, strPos);
      
      // 檢查是否看起來像模型名稱（包含 gpt, whisper 等關鍵字）
      if (
        str.includes("gpt") ||
        str.includes("whisper") ||
        str.includes("4o") ||
        str.includes("turbo")
      ) {
        // 檢查是否在已知模型列表中
        const isKnownModel = models.some(m => m.name === str);
        
        if (!isKnownModel) {
          issues.push({
            type: "model",
            severity: "error",
            file: relPath,
            line,
            message: `未知的模型名稱: "${str}"`,
            actual: str,
            suggestion: `請檢查 shared/config.ts 中是否定義此模型，或更新文件中的模型名稱`,
          });
        }
      }
    }
  }
  
  // 2. 檢查表格中的模型引用
  const tables = extractTables(content);
  
  for (const table of tables) {
    const rows = parseTable(table);
    
    // 尋找包含 "模型" 或 "model" 的欄位
    if (rows.length > 0) {
      const headers = rows[0];
      const modelColumnIndex = headers.findIndex(
        h => h.toLowerCase().includes("model") || h.includes("模型")
      );
      
      if (modelColumnIndex !== -1) {
        // 檢查每一行的模型欄位
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const modelValue = row[modelColumnIndex];
          
          if (modelValue) {
            // 提取模型名稱（移除 markdown 格式）
            const cleanValue = modelValue.replace(/[`*_]/g, "").trim();
            
            // 檢查是否看起來像模型名稱
            if (
              cleanValue.includes("gpt") ||
              cleanValue.includes("whisper") ||
              cleanValue.includes("4o") ||
              cleanValue.includes("turbo")
            ) {
              const isKnownModel = models.some(m => m.name === cleanValue);
              
              if (!isKnownModel) {
                // 找到表格在文件中的位置
                const tablePos = content.indexOf(table);
                const line = getLineNumber(content, tablePos);
                
                issues.push({
                  type: "model",
                  severity: "error",
                  file: relPath,
                  line: line + i,
                  message: `表格中的未知模型名稱: "${cleanValue}"`,
                  actual: cleanValue,
                  suggestion: `請檢查 shared/config.ts 中是否定義此模型`,
                });
              }
            }
          }
        }
      }
    }
  }
  
  // 3. 檢查內文中的模型引用（使用反引號標記的）
  const inlineCodePattern = /`([^`]+)`/g;
  const inlineCodes = findAllMatches(content, inlineCodePattern);
  
  for (const match of inlineCodes) {
    const code = match[1];
    const pos = match.index || 0;
    const line = getLineNumber(content, pos);
    
    // 檢查是否看起來像模型名稱
    if (
      code.includes("gpt") ||
      code.includes("whisper") ||
      code.includes("4o") ||
      code.includes("turbo")
    ) {
      const isKnownModel = models.some(m => m.name === code);
      
      if (!isKnownModel) {
        issues.push({
          type: "model",
          severity: "warning",
          file: relPath,
          line,
          message: `可能的未知模型名稱: "${code}"`,
          actual: code,
          suggestion: `如果這是模型名稱，請檢查 shared/config.ts 中是否定義`,
        });
      }
    }
  }
  
  return issues;
}

/**
 * 執行模型名稱檢查
 */
export async function checkModels(): Promise<CheckResult> {
  const startTime = Date.now();
  const projectRoot = getProjectRoot();
  const configPath = path.join(projectRoot, "shared", "config.ts");
  
  // 提取模型定義
  const models = extractModelDefinitions(configPath);
  
  console.log(`✓ 從 config.ts 提取到 ${models.length} 個模型定義`);
  console.log(`  - ASR 模型: ${models.filter(m => m.type === "asr").map(m => m.name).join(", ")}`);
  console.log(`  - 翻譯模型: ${models.filter(m => m.type === "translation").map(m => m.name).join(", ")}`);
  
  // 掃描所有 Markdown 檔案
  const docsDir = path.join(projectRoot, "docs");
  const markdownFiles = scanMarkdownFiles(docsDir);
  
  console.log(`✓ 掃描到 ${markdownFiles.length} 個 Markdown 檔案`);
  
  // 檢查每個檔案
  const allIssues: CheckIssue[] = [];
  
  for (const file of markdownFiles) {
    const content = readFile(file);
    const issues = extractModelReferencesFromDoc(file, content, models);
    allIssues.push(...issues);
  }
  
  const duration = Date.now() - startTime;
  
  return {
    type: "model",
    name: "模型名稱檢查",
    filesChecked: markdownFiles.length,
    issues: allIssues,
    duration,
  };
}
