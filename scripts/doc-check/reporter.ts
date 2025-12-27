/**
 * 文件檢查工具 - 報告產生器
 * 
 * 產生人類可讀的檢查報告
 */

import { CheckReport, CheckResult, CheckIssue, Severity } from "./types";
import { formatDuration } from "./utils";

/**
 * 產生控制台報告
 */
export function generateConsoleReport(report: CheckReport): string {
  const lines: string[] = [];
  
  // 標題
  lines.push("=".repeat(80));
  lines.push("📋 文件檢查報告");
  lines.push("=".repeat(80));
  lines.push("");
  
  // 摘要
  lines.push("📊 檢查摘要");
  lines.push("-".repeat(80));
  lines.push(`檢查時間: ${report.timestamp}`);
  lines.push(`總檔案數: ${report.totalFiles}`);
  lines.push(`總問題數: ${report.totalIssues}`);
  lines.push(`  - 錯誤 (❌): ${report.errorCount}`);
  lines.push(`  - 警告 (⚠️): ${report.warningCount}`);
  lines.push(`  - 資訊 (ℹ️): ${report.infoCount}`);
  lines.push(`總耗時: ${formatDuration(report.totalDuration)}`);
  lines.push("");
  
  // 各項檢查結果
  for (const result of report.results) {
    lines.push(`\n${"=".repeat(80)}`);
    lines.push(`📝 ${result.name}`);
    lines.push(`${"=".repeat(80)}`);
    lines.push(`檢查檔案數: ${result.filesChecked}`);
    lines.push(`發現問題數: ${result.issues.length}`);
    lines.push(`耗時: ${formatDuration(result.duration)}`);
    
    if (result.issues.length > 0) {
      lines.push("");
      lines.push("問題列表:");
      lines.push("-".repeat(80));
      
      for (const issue of result.issues) {
        lines.push("");
        lines.push(`${getSeverityIcon(issue.severity)} ${issue.message}`);
        lines.push(`   檔案: ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
        
        if (issue.expected) {
          lines.push(`   期望: ${issue.expected}`);
        }
        if (issue.actual) {
          lines.push(`   實際: ${issue.actual}`);
        }
        if (issue.suggestion) {
          lines.push(`   建議: ${issue.suggestion}`);
        }
      }
    } else {
      lines.push("");
      lines.push("✅ 未發現問題");
    }
  }
  
  // 結論
  lines.push("");
  lines.push("=".repeat(80));
  if (report.errorCount === 0) {
    lines.push("✅ 所有檢查通過！");
  } else {
    lines.push(`❌ 發現 ${report.errorCount} 個錯誤，請修正後再次檢查`);
  }
  lines.push("=".repeat(80));
  
  return lines.join("\n");
}

/**
 * 產生 Markdown 報告
 */
export function generateMarkdownReport(report: CheckReport): string {
  const lines: string[] = [];
  
  // 標題
  lines.push("# 文件檢查報告");
  lines.push("");
  lines.push(`**檢查時間:** ${report.timestamp}`);
  lines.push("");
  
  // 摘要
  lines.push("## 📊 檢查摘要");
  lines.push("");
  lines.push("| 項目 | 數量 |");
  lines.push("|------|------|");
  lines.push(`| 總檔案數 | ${report.totalFiles} |`);
  lines.push(`| 總問題數 | ${report.totalIssues} |`);
  lines.push(`| 錯誤 (❌) | ${report.errorCount} |`);
  lines.push(`| 警告 (⚠️) | ${report.warningCount} |`);
  lines.push(`| 資訊 (ℹ️) | ${report.infoCount} |`);
  lines.push(`| 總耗時 | ${formatDuration(report.totalDuration)} |`);
  lines.push("");
  
  // 各項檢查結果
  for (const result of report.results) {
    lines.push(`## 📝 ${result.name}`);
    lines.push("");
    lines.push(`- **檢查檔案數:** ${result.filesChecked}`);
    lines.push(`- **發現問題數:** ${result.issues.length}`);
    lines.push(`- **耗時:** ${formatDuration(result.duration)}`);
    lines.push("");
    
    if (result.issues.length > 0) {
      lines.push("### 問題列表");
      lines.push("");
      
      for (let i = 0; i < result.issues.length; i++) {
        const issue = result.issues[i];
        lines.push(`#### ${i + 1}. ${getSeverityIcon(issue.severity)} ${issue.message}`);
        lines.push("");
        lines.push(`- **檔案:** \`${issue.file}${issue.line ? `:${issue.line}` : ""}\``);
        
        if (issue.expected) {
          lines.push(`- **期望:** \`${issue.expected}\``);
        }
        if (issue.actual) {
          lines.push(`- **實際:** \`${issue.actual}\``);
        }
        if (issue.suggestion) {
          lines.push(`- **建議:** ${issue.suggestion}`);
        }
        lines.push("");
      }
    } else {
      lines.push("✅ **未發現問題**");
      lines.push("");
    }
  }
  
  // 結論
  lines.push("## 結論");
  lines.push("");
  if (report.errorCount === 0) {
    lines.push("✅ **所有檢查通過！**");
  } else {
    lines.push(`❌ **發現 ${report.errorCount} 個錯誤，請修正後再次檢查**`);
  }
  
  return lines.join("\n");
}

/**
 * 產生 JSON 報告
 */
export function generateJsonReport(report: CheckReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * 產生 GitHub Actions 註解格式
 */
export function generateGitHubActionsAnnotations(report: CheckReport): string[] {
  const annotations: string[] = [];
  
  for (const result of report.results) {
    for (const issue of result.issues) {
      const level = issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "notice";
      const file = issue.file;
      const line = issue.line || 1;
      
      let message = issue.message;
      if (issue.expected) {
        message += ` (期望: ${issue.expected})`;
      }
      if (issue.actual) {
        message += ` (實際: ${issue.actual})`;
      }
      
      annotations.push(`::${level} file=${file},line=${line}::${message}`);
    }
  }
  
  return annotations;
}

/**
 * 取得嚴重程度圖示
 */
function getSeverityIcon(severity: Severity): string {
  switch (severity) {
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "•";
  }
}

/**
 * 產生摘要統計
 */
export function generateSummary(report: CheckReport): string {
  const lines: string[] = [];
  
  lines.push(`檢查完成: ${report.totalFiles} 個檔案`);
  lines.push(`發現問題: ${report.totalIssues} 個 (錯誤: ${report.errorCount}, 警告: ${report.warningCount}, 資訊: ${report.infoCount})`);
  lines.push(`總耗時: ${formatDuration(report.totalDuration)}`);
  
  if (report.errorCount === 0) {
    lines.push("✅ 所有檢查通過");
  } else {
    lines.push(`❌ 發現 ${report.errorCount} 個錯誤`);
  }
  
  return lines.join("\n");
}
