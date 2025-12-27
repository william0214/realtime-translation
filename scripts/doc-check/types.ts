/**
 * 文件檢查工具 - 型別定義
 * 
 * 定義所有檢查結果的資料結構
 */

/**
 * 檢查嚴重程度
 */
export type Severity = "error" | "warning" | "info";

/**
 * 檢查類型
 */
export type CheckType = "model" | "config" | "path" | "state-machine" | "api";

/**
 * 單一檢查問題
 */
export interface CheckIssue {
  /** 問題類型 */
  type: CheckType;
  /** 嚴重程度 */
  severity: Severity;
  /** 檔案路徑 */
  file: string;
  /** 行號（可選） */
  line?: number;
  /** 問題描述 */
  message: string;
  /** 期望值 */
  expected?: string;
  /** 實際值 */
  actual?: string;
  /** 修正建議 */
  suggestion?: string;
}

/**
 * 檢查結果
 */
export interface CheckResult {
  /** 檢查類型 */
  type: CheckType;
  /** 檢查名稱 */
  name: string;
  /** 檢查的檔案數量 */
  filesChecked: number;
  /** 發現的問題 */
  issues: CheckIssue[];
  /** 檢查耗時（毫秒） */
  duration: number;
}

/**
 * 完整檢查報告
 */
export interface CheckReport {
  /** 檢查時間 */
  timestamp: string;
  /** 檢查結果列表 */
  results: CheckResult[];
  /** 總檔案數 */
  totalFiles: number;
  /** 總問題數 */
  totalIssues: number;
  /** 錯誤數 */
  errorCount: number;
  /** 警告數 */
  warningCount: number;
  /** 資訊數 */
  infoCount: number;
  /** 總耗時（毫秒） */
  totalDuration: number;
}

/**
 * 模型定義（從 config 提取）
 */
export interface ModelDefinition {
  /** 模型名稱 */
  name: string;
  /** 模型類型（asr/translation） */
  type: "asr" | "translation";
  /** 模型描述 */
  description?: string;
}

/**
 * 配置參數定義（從 config 提取）
 */
export interface ConfigParameter {
  /** 參數名稱 */
  name: string;
  /** 參數類型 */
  type: string;
  /** 預設值 */
  defaultValue: any;
  /** 可選值 */
  allowedValues?: any[];
  /** 參數描述 */
  description?: string;
}

/**
 * 檔案路徑引用
 */
export interface FilePathReference {
  /** 引用的檔案路徑 */
  path: string;
  /** 引用位置（文件檔案） */
  referencedIn: string;
  /** 引用行號 */
  line: number;
  /** 行號引用（可選） */
  lineReference?: number;
}
