/**
 * 文件檢查工具 - 檔案路徑檢查
 * 
 * 檢查文件中引用的檔案路徑和行號是否有效
 */

import * as path from "path";
import {
  CheckResult,
  CheckIssue,
  FilePathReference,
} from "./types";
import {
  getProjectRoot,
  scanMarkdownFiles,
  readFile,
  fileExists,
  getLineNumber,
  getRelativePathFromRoot,
  findAllMatches,
  getLineContent,
} from "./utils";

/**
 * 從文件中提取檔案路徑引用
 */
function extractFilePathReferences(
  filePath: string,
  content: string
): FilePathReference[] {
  const references: FilePathReference[] = [];
  const relPath = getRelativePathFromRoot(filePath);
  
  // 1. 提取程式碼區塊中的檔案路徑引用
  // 格式: client/src/pages/Home.tsx, server/routers.ts, shared/config.ts 等
  const codeBlockPattern = /```[\w]*\s*\n([\s\S]*?)\n```/g;
  const codeBlocks = findAllMatches(content, codeBlockPattern);
  
  for (const match of codeBlocks) {
    const codeContent = match[1] || "";
    const codeStartPos = match.index || 0;
    
    // 尋找看起來像檔案路徑的字串
    // 格式: path/to/file.ext 或 path/to/file.ext:123
    const pathPattern = /([\w\-./]+\/[\w\-./]+\.\w+)(?::(\d+))?/g;
    const pathMatches = findAllMatches(codeContent, pathPattern);
    
    for (const pathMatch of pathMatches) {
      const pathStr = pathMatch[1];
      const lineRef = pathMatch[2] ? parseInt(pathMatch[2]) : undefined;
      const pathPos = codeStartPos + (pathMatch.index || 0);
      const line = getLineNumber(content, pathPos);
      
      references.push({
        path: pathStr,
        referencedIn: relPath,
        line,
        lineReference: lineRef,
      });
    }
  }
  
  // 2. 提取內文中的檔案路徑引用（使用反引號標記的）
  // 格式: `client/src/pages/Home.tsx` 或 `server/routers.ts:45`
  const inlineCodePattern = /`([^`]+)`/g;
  const inlineCodes = findAllMatches(content, inlineCodePattern);
  
  for (const match of inlineCodes) {
    const code = match[1];
    const pos = match.index || 0;
    const line = getLineNumber(content, pos);
    
    // 檢查是否看起來像檔案路徑
    const pathMatch = code.match(/([\w\-./]+\/[\w\-./]+\.\w+)(?::(\d+))?/);
    if (pathMatch) {
      const pathStr = pathMatch[1];
      const lineRef = pathMatch[2] ? parseInt(pathMatch[2]) : undefined;
      
      references.push({
        path: pathStr,
        referencedIn: relPath,
        line,
        lineReference: lineRef,
      });
    }
  }
  
  // 3. 提取 Markdown 連結中的檔案路徑
  // 格式: [text](path/to/file.md) 或 [text](path/to/file.md#section)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = findAllMatches(content, linkPattern);
  
  for (const match of links) {
    const linkUrl = match[2];
    const pos = match.index || 0;
    const line = getLineNumber(content, pos);
    
    // 跳過外部連結（http/https）
    if (linkUrl.startsWith("http://") || linkUrl.startsWith("https://")) {
      continue;
    }
    
    // 移除 anchor（#section）
    const pathStr = linkUrl.split("#")[0];
    
    // 檢查是否為檔案路徑（包含副檔名）
    if (pathStr.includes(".")) {
      references.push({
        path: pathStr,
        referencedIn: relPath,
        line,
      });
    }
  }
  
  return references;
}

/**
 * 驗證檔案路徑引用
 */
function validateFilePathReference(
  reference: FilePathReference,
  projectRoot: string
): CheckIssue | null {
  const { path: pathStr, referencedIn, line, lineReference } = reference;
  
  // 解析檔案路徑（相對於專案根目錄）
  let fullPath: string;
  
  // 如果是相對路徑（以 ./ 或 ../ 開頭），相對於引用文件
  if (pathStr.startsWith("./") || pathStr.startsWith("../")) {
    const docDir = path.dirname(path.join(projectRoot, referencedIn));
    fullPath = path.resolve(docDir, pathStr);
  } else {
    // 否則相對於專案根目錄
    fullPath = path.join(projectRoot, pathStr);
  }
  
  // 檢查檔案是否存在
  if (!fileExists(fullPath)) {
    return {
      type: "path",
      severity: "error",
      file: referencedIn,
      line,
      message: `引用的檔案不存在: "${pathStr}"`,
      actual: pathStr,
      suggestion: `請檢查檔案路徑是否正確，或移除此引用`,
    };
  }
  
  // 如果有行號引用，檢查行號是否有效
  if (lineReference !== undefined) {
    try {
      const fileContent = readFile(fullPath);
      const lines = fileContent.split("\n");
      
      if (lineReference < 1 || lineReference > lines.length) {
        return {
          type: "path",
          severity: "warning",
          file: referencedIn,
          line,
          message: `引用的行號超出範圍: "${pathStr}:${lineReference}"`,
          expected: `1-${lines.length}`,
          actual: String(lineReference),
          suggestion: `請更新行號引用，檔案共有 ${lines.length} 行`,
        };
      }
      
      // 可選：檢查引用的行是否為空行
      const referencedLine = lines[lineReference - 1];
      if (referencedLine.trim() === "") {
        return {
          type: "path",
          severity: "info",
          file: referencedIn,
          line,
          message: `引用的行號指向空行: "${pathStr}:${lineReference}"`,
          actual: String(lineReference),
          suggestion: `請檢查行號引用是否正確`,
        };
      }
    } catch (error) {
      // 讀取檔案失敗，可能是二進位檔案
      return null;
    }
  }
  
  return null;
}

/**
 * 執行檔案路徑檢查
 */
export async function checkPaths(): Promise<CheckResult> {
  const startTime = Date.now();
  const projectRoot = getProjectRoot();
  
  // 掃描所有 Markdown 檔案
  const docsDir = path.join(projectRoot, "docs");
  const markdownFiles = scanMarkdownFiles(docsDir);
  
  console.log(`✓ 掃描到 ${markdownFiles.length} 個 Markdown 檔案`);
  
  // 提取所有檔案路徑引用
  const allReferences: FilePathReference[] = [];
  
  for (const file of markdownFiles) {
    const content = readFile(file);
    const references = extractFilePathReferences(file, content);
    allReferences.push(...references);
  }
  
  console.log(`✓ 找到 ${allReferences.length} 個檔案路徑引用`);
  
  // 驗證每個引用
  const allIssues: CheckIssue[] = [];
  
  for (const reference of allReferences) {
    const issue = validateFilePathReference(reference, projectRoot);
    if (issue) {
      allIssues.push(issue);
    }
  }
  
  const duration = Date.now() - startTime;
  
  return {
    type: "path",
    name: "檔案路徑檢查",
    filesChecked: markdownFiles.length,
    issues: allIssues,
    duration,
  };
}
