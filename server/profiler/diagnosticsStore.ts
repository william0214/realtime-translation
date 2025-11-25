/**
 * Diagnostics Store
 * Stores the latest diagnostic report in memory
 */

import type { DiagnosticReport } from "./bottleneckDetector";

class DiagnosticsStore {
  private latestReport: DiagnosticReport | null = null;

  setReport(report: DiagnosticReport): void {
    this.latestReport = report;
    console.log("[Diagnostics Store] Report updated:", {
      timestamp: new Date(report.timestamp).toISOString(),
      bottleneck: report.bottleneck.bottleneck,
      severity: report.bottleneck.severity,
    });
  }

  getReport(): DiagnosticReport | null {
    return this.latestReport;
  }

  clear(): void {
    this.latestReport = null;
  }
}

export const diagnosticsStore = new DiagnosticsStore();
