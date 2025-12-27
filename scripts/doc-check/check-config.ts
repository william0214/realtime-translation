/**
 * 文件檢查工具 - 配置參數檢查
 * 
 * 檢查文件中的配置參數表格是否與 shared/config.ts 中的定義一致
 */

import * as path from "path";
import {
  CheckResult,
  CheckIssue,
  ConfigParameter,
} from "./types";
import {
  getProjectRoot,
  scanMarkdownFiles,
  readFile,
  getLineNumber,
  getRelativePathFromRoot,
  extractTables,
  parseTable,
} from "./utils";

/**
 * 從 shared/config.ts 提取配置參數定義
 */
function extractConfigParameters(configPath: string): Map<string, ConfigParameter> {
  const content = readFile(configPath);
  const parameters = new Map<string, ConfigParameter>();
  
  // 1. 提取 VAD 配置參數（從 ASR_MODE_CONFIG）
  const asrModeConfigMatch = content.match(/export const ASR_MODE_CONFIG[\s\S]*?= \{([\s\S]*?)\n\};/);
  if (asrModeConfigMatch) {
    const configContent = asrModeConfigMatch[1];
    
    // 提取 normal 模式的配置
    const normalMatch = configContent.match(/normal: \{([\s\S]*?)\n  \}/);
    if (normalMatch) {
      const normalConfig = normalMatch[1];
      
      // 提取各個參數
      extractParameter(normalConfig, "rmsThreshold", "number", parameters);
      extractParameter(normalConfig, "silenceDurationMs", "number", parameters);
      extractParameter(normalConfig, "minSpeechDurationMs", "number", parameters);
      extractParameter(normalConfig, "vadStartThreshold", "number", parameters);
      extractParameter(normalConfig, "vadEndThreshold", "number", parameters);
      extractParameter(normalConfig, "vadStartFrames", "number", parameters);
      extractParameter(normalConfig, "vadEndFrames", "number", parameters);
      extractParameter(normalConfig, "minPartialDurationMs", "number", parameters);
      extractParameter(normalConfig, "minFinalDurationMs", "number", parameters);
      extractParameter(normalConfig, "maxFinalSec", "number", parameters);
      extractParameter(normalConfig, "partialThrottleMs", "number", parameters);
    }
  }
  
  // 2. 提取 ASR 模型配置
  const asrModelsMatch = content.match(/export const ASR_MODELS = \{([\s\S]*?)\n\};/);
  if (asrModelsMatch) {
    const modelsContent = asrModelsMatch[1];
    
    // 提取模型名稱作為參數
    const modelMatches = modelsContent.matchAll(/"([^"]+)": \{[\s\S]*?label: "([^"]+)"/g);
    for (const match of modelMatches) {
      const modelName = match[1];
      const label = match[2];
      
      parameters.set(`asr_model_${modelName}`, {
        name: modelName,
        type: "string",
        defaultValue: modelName,
        description: label,
      });
    }
  }
  
  // 3. 提取翻譯模型配置
  const translationModelsMatch = content.match(/export const TRANSLATION_MODELS = \[([\s\S]*?)\];/);
  if (translationModelsMatch) {
    const modelsContent = translationModelsMatch[1];
    const modelMatches = modelsContent.matchAll(/"([^"]+)"/g);
    
    for (const match of modelMatches) {
      const modelName = match[1];
      
      parameters.set(`translation_model_${modelName}`, {
        name: modelName,
        type: "string",
        defaultValue: modelName,
        description: `Translation model: ${modelName}`,
      });
    }
  }
  
  return parameters;
}

/**
 * 從配置內容中提取單一參數
 */
function extractParameter(
  configContent: string,
  paramName: string,
  paramType: string,
  parameters: Map<string, ConfigParameter>
): void {
  const pattern = new RegExp(`${paramName}:\\s*([^,\\n]+)`);
  const match = configContent.match(pattern);
  
  if (match) {
    const valueStr = match[1].trim();
    let value: any = valueStr;
    
    // 解析數值
    if (paramType === "number") {
      value = parseFloat(valueStr);
    } else if (paramType === "boolean") {
      value = valueStr === "true";
    } else if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
      value = valueStr.slice(1, -1);
    }
    
    parameters.set(paramName, {
      name: paramName,
      type: paramType,
      defaultValue: value,
      description: `Configuration parameter: ${paramName}`,
    });
  }
}

/**
 * 檢查文件中的配置參數表格
 */
function checkConfigTablesInDoc(
  filePath: string,
  content: string,
  parameters: Map<string, ConfigParameter>
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const relPath = getRelativePathFromRoot(filePath);
  
  // 提取所有表格
  const tables = extractTables(content);
  
  for (const table of tables) {
    const rows = parseTable(table);
    
    if (rows.length === 0) continue;
    
    const headers = rows[0].map(h => h.toLowerCase());
    
    // 檢查是否為配置參數表格（包含 "參數" 或 "parameter" 欄位）
    const hasParameterColumn = headers.some(h => 
      h.includes("參數") || 
      h.includes("parameter") || 
      h.includes("名稱") ||
      h.includes("name")
    );
    
    const hasDefaultColumn = headers.some(h => 
      h.includes("預設") || 
      h.includes("default") ||
      h.includes("值") ||
      h.includes("value")
    );
    
    if (!hasParameterColumn) continue;
    
    // 找到參數名稱和預設值的欄位索引
    const paramColumnIndex = headers.findIndex(h => 
      h.includes("參數") || 
      h.includes("parameter") ||
      h.includes("名稱") ||
      h.includes("name")
    );
    
    const defaultColumnIndex = headers.findIndex(h => 
      h.includes("預設") || 
      h.includes("default") ||
      (h.includes("值") && !h.includes("範圍")) ||
      h.includes("value")
    );
    
    const typeColumnIndex = headers.findIndex(h => 
      h.includes("型別") || 
      h.includes("type") ||
      h.includes("類型")
    );
    
    // 檢查每一行
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (paramColumnIndex === -1 || !row[paramColumnIndex]) continue;
      
      const paramName = row[paramColumnIndex].replace(/[`*_]/g, "").trim();
      const docDefaultValue = defaultColumnIndex !== -1 ? row[defaultColumnIndex].replace(/[`*_]/g, "").trim() : null;
      const docType = typeColumnIndex !== -1 ? row[typeColumnIndex].replace(/[`*_]/g, "").trim() : null;
      
      // 跳過空行或標題行
      if (!paramName || paramName === "-") continue;
      
      // 檢查參數是否在 config 中定義
      const configParam = parameters.get(paramName);
      
      if (!configParam) {
        // 檢查是否為模型名稱（特殊處理）
        const isModelParam = paramName.includes("gpt") || 
                            paramName.includes("whisper") || 
                            paramName.includes("4o");
        
        if (!isModelParam) {
          const tablePos = content.indexOf(table);
          const line = getLineNumber(content, tablePos) + i;
          
          issues.push({
            type: "config",
            severity: "warning",
            file: relPath,
            line,
            message: `文件中的參數 "${paramName}" 未在 config.ts 中找到`,
            actual: paramName,
            suggestion: `請檢查參數名稱是否正確，或在 config.ts 中加入此參數定義`,
          });
        }
        continue;
      }
      
      // 檢查預設值是否一致
      if (docDefaultValue && hasDefaultColumn) {
        const configDefaultStr = String(configParam.defaultValue);
        
        // 正規化比較（移除空格、引號等）
        const normalizedDocValue = docDefaultValue.replace(/[`'"]/g, "").trim();
        const normalizedConfigValue = configDefaultStr.replace(/[`'"]/g, "").trim();
        
        if (normalizedDocValue !== normalizedConfigValue) {
          const tablePos = content.indexOf(table);
          const line = getLineNumber(content, tablePos) + i;
          
          issues.push({
            type: "config",
            severity: "error",
            file: relPath,
            line,
            message: `參數 "${paramName}" 的預設值不一致`,
            expected: configDefaultStr,
            actual: docDefaultValue,
            suggestion: `請更新文件中的預設值為 ${configDefaultStr}`,
          });
        }
      }
      
      // 檢查型別是否一致
      if (docType && typeColumnIndex !== -1) {
        const normalizedDocType = docType.toLowerCase().replace(/[`'"]/g, "").trim();
        const normalizedConfigType = configParam.type.toLowerCase();
        
        // 簡單的型別對應
        const typeMapping: Record<string, string[]> = {
          "number": ["number", "數字", "float", "int", "integer"],
          "string": ["string", "字串", "text"],
          "boolean": ["boolean", "布林", "bool"],
        };
        
        let typeMatches = false;
        for (const [configType, docTypes] of Object.entries(typeMapping)) {
          if (normalizedConfigType === configType && docTypes.some(t => normalizedDocType.includes(t))) {
            typeMatches = true;
            break;
          }
        }
        
        if (!typeMatches && normalizedDocType !== normalizedConfigType) {
          const tablePos = content.indexOf(table);
          const line = getLineNumber(content, tablePos) + i;
          
          issues.push({
            type: "config",
            severity: "warning",
            file: relPath,
            line,
            message: `參數 "${paramName}" 的型別可能不一致`,
            expected: configParam.type,
            actual: docType,
            suggestion: `請檢查型別定義是否正確`,
          });
        }
      }
    }
  }
  
  return issues;
}

/**
 * 執行配置參數檢查
 */
export async function checkConfig(): Promise<CheckResult> {
  const startTime = Date.now();
  const projectRoot = getProjectRoot();
  const configPath = path.join(projectRoot, "shared", "config.ts");
  
  // 提取配置參數
  const parameters = extractConfigParameters(configPath);
  
  console.log(`✓ 從 config.ts 提取到 ${parameters.size} 個配置參數`);
  
  // 列出主要參數
  const mainParams = Array.from(parameters.keys())
    .filter(k => !k.startsWith("asr_model_") && !k.startsWith("translation_model_"))
    .slice(0, 10);
  
  if (mainParams.length > 0) {
    console.log(`  - 主要參數: ${mainParams.join(", ")}`);
  }
  
  // 掃描所有 Markdown 檔案
  const docsDir = path.join(projectRoot, "docs");
  const markdownFiles = scanMarkdownFiles(docsDir);
  
  console.log(`✓ 掃描到 ${markdownFiles.length} 個 Markdown 檔案`);
  
  // 檢查每個檔案
  const allIssues: CheckIssue[] = [];
  
  for (const file of markdownFiles) {
    const content = readFile(file);
    const issues = checkConfigTablesInDoc(file, content, parameters);
    allIssues.push(...issues);
  }
  
  const duration = Date.now() - startTime;
  
  return {
    type: "config",
    name: "配置參數檢查",
    filesChecked: markdownFiles.length,
    issues: allIssues,
    duration,
  };
}
