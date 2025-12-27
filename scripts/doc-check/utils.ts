/**
 * 文件檢查工具 - 共用工具函數
 * 
 * 提供檔案掃描、文字處理等共用功能
 */

import * as fs from "fs";
import * as path from "path";

/**
 * 掃描目錄下的所有 Markdown 檔案
 */
export function scanMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  
  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳過 node_modules, .git 等目錄
        if (!["node_modules", ".git", "dist", "build"].includes(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return files;
}

/**
 * 讀取檔案內容
 */
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * 檢查檔案是否存在
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * 取得相對路徑
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * 取得專案根目錄
 */
export function getProjectRoot(): string {
  // 在 ESM 模組中，使用 import.meta.url 取得當前檔案路徑
  const currentFileUrl = new URL(import.meta.url);
  const currentFilePath = currentFileUrl.pathname;
  const currentDir = path.dirname(currentFilePath);
  // 假設此腳本在 scripts/doc-check/ 目錄下
  return path.resolve(currentDir, "../..");
}

/**
 * 在文字中尋找所有匹配的模式
 */
export function findAllMatches(text: string, pattern: RegExp): RegExpMatchArray[] {
  const matches: RegExpMatchArray[] = [];
  let match: RegExpExecArray | null;
  
  // 確保 pattern 有 global flag
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  
  while ((match = globalPattern.exec(text)) !== null) {
    matches.push(match as RegExpMatchArray);
  }
  
  return matches;
}

/**
 * 取得文字中某個位置的行號
 */
export function getLineNumber(text: string, position: number): number {
  const lines = text.substring(0, position).split("\n");
  return lines.length;
}

/**
 * 取得檔案的某一行內容
 */
export function getLineContent(text: string, lineNumber: number): string {
  const lines = text.split("\n");
  return lines[lineNumber - 1] || "";
}

/**
 * 正規化檔案路徑（統一使用 POSIX 格式）
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * 從文字中提取程式碼區塊
 */
export function extractCodeBlocks(text: string, language?: string): string[] {
  const pattern = language
    ? new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\`\`\``, "g")
    : /```[\w]*\s*\n([\s\S]*?)\n```/g;
  
  const matches = findAllMatches(text, pattern);
  return matches.map(match => match[1] || "");
}

/**
 * 從文字中提取表格
 */
export function extractTables(text: string): string[] {
  const tables: string[] = [];
  const lines = text.split("\n");
  let currentTable: string[] = [];
  let inTable = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 檢查是否為表格行（包含 | 符號）
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      currentTable.push(line);
    } else if (inTable) {
      // 表格結束
      if (currentTable.length > 0) {
        tables.push(currentTable.join("\n"));
        currentTable = [];
      }
      inTable = false;
    }
  }
  
  // 處理最後一個表格
  if (currentTable.length > 0) {
    tables.push(currentTable.join("\n"));
  }
  
  return tables;
}

/**
 * 解析表格為二維陣列
 */
export function parseTable(tableText: string): string[][] {
  const lines = tableText.split("\n").filter(line => line.trim());
  const rows: string[][] = [];
  
  for (const line of lines) {
    // 跳過分隔線（如 |---|---|）
    if (line.includes("---")) continue;
    
    // 分割並清理每個儲存格
    const cells = line
      .split("|")
      .slice(1, -1) // 移除首尾的空字串
      .map(cell => cell.trim());
    
    rows.push(cells);
  }
  
  return rows;
}

/**
 * 格式化時間（毫秒 → 可讀格式）
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 取得檔案的相對路徑（相對於專案根目錄）
 */
export function getRelativePathFromRoot(filePath: string): string {
  const root = getProjectRoot();
  return getRelativePath(root, filePath);
}
