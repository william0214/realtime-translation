#!/usr/bin/env node
/**
 * 文件檢查工具 - 主程式
 * 
 * 執行所有文件檢查並產生報告
 */

import { CheckReport } from "./types";
import { checkModels } from "./check-models";
import { checkConfig } from "./check-config";
import { checkPaths } from "./check-paths";
import {
  generateConsoleReport,
  generateMarkdownReport,
  generateJsonReport,
  generateGitHubActionsAnnotations,
  generateSummary,
} from "./reporter";
import * as fs from "fs";
import * as path from "path";

/**
 * 主程式
 */
async function main() {
  const args = process.argv.slice(2);
  const outputFormat = args.find(arg => arg.startsWith("--format="))?.split("=")[1] || "console";
  const outputFile = args.find(arg => arg.startsWith("--output="))?.split("=")[1];
  const githubActions = args.includes("--github-actions");
  
  console.log("🔍 開始執行文件檢查...\n");
  
  const startTime = Date.now();
  const results = [];
  
  // 1. 執行模型名稱檢查
  console.log("📝 執行模型名稱檢查...");
  try {
    const modelResult = await checkModels();
    results.push(modelResult);
    console.log(`✓ 完成 (${modelResult.issues.length} 個問題)\n`);
  } catch (error) {
    console.error(`✗ 模型名稱檢查失敗:`, error);
    process.exit(1);
  }
  
  // 2. 執行配置參數檢查
  console.log("📝 執行配置參數檢查...");
  try {
    const configResult = await checkConfig();
    results.push(configResult);
    console.log(`✓ 完成 (${configResult.issues.length} 個問題)\n`);
  } catch (error) {
    console.error(`✗ 配置參數檢查失敗:`, error);
    process.exit(1);
  }
  
  // 3. 執行檔案路徑檢查
  console.log("📝 執行檔案路徑檢查...");
  try {
    const pathResult = await checkPaths();
    results.push(pathResult);
    console.log(`✓ 完成 (${pathResult.issues.length} 個問題)\n`);
  } catch (error) {
    console.error(`✗ 檔案路徑檢查失敗:`, error);
    process.exit(1);
  }
  
  // 產生報告
  const totalDuration = Date.now() - startTime;
  const totalFiles = Math.max(...results.map(r => r.filesChecked));
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const errorCount = results.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === "error").length,
    0
  );
  const warningCount = results.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === "warning").length,
    0
  );
  const infoCount = results.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === "info").length,
    0
  );
  
  const report: CheckReport = {
    timestamp: new Date().toISOString(),
    results,
    totalFiles,
    totalIssues,
    errorCount,
    warningCount,
    infoCount,
    totalDuration,
  };
  
  // 輸出報告
  let reportContent: string;
  
  switch (outputFormat) {
    case "markdown":
    case "md":
      reportContent = generateMarkdownReport(report);
      break;
    case "json":
      reportContent = generateJsonReport(report);
      break;
    case "console":
    default:
      reportContent = generateConsoleReport(report);
      break;
  }
  
  // 輸出到檔案或控制台
  if (outputFile) {
    const outputPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(outputPath, reportContent, "utf-8");
    console.log(`\n📄 報告已儲存至: ${outputPath}`);
  } else {
    console.log("\n" + reportContent);
  }
  
  // GitHub Actions 註解
  if (githubActions) {
    const annotations = generateGitHubActionsAnnotations(report);
    for (const annotation of annotations) {
      console.log(annotation);
    }
  }
  
  // 輸出摘要
  console.log("\n" + "=".repeat(80));
  console.log(generateSummary(report));
  console.log("=".repeat(80));
  
  // 如果有錯誤，返回非零退出碼
  if (errorCount > 0) {
    process.exit(1);
  }
}

// 執行主程式
main().catch(error => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});
