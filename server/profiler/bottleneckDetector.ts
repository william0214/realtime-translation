/**
 * Bottleneck Detector
 * Automatically analyzes performance metrics and identifies bottlenecks
 */

import type { ASRProfileResult } from "./asrProfiler";
import type { TranslationProfileResult } from "./translationProfiler";
import type { TTSProfileResult } from "./ttsProfiler";
import type { ChunkProfileResult } from "./chunkProfiler";
import type { E2EProfileResult } from "./e2eProfiler";

export type Severity = "green" | "yellow" | "red";

export interface BottleneckResult {
  bottleneck: string;
  severity: Severity;
  details: string[];
}

export interface DiagnosticReport {
  asr?: ASRProfileResult;
  translation?: TranslationProfileResult;
  tts?: TTSProfileResult;
  chunk?: ChunkProfileResult;
  e2e?: E2EProfileResult;
  bottleneck: BottleneckResult;
  timestamp: number;
}

export class BottleneckDetector {
  // Thresholds (ms)
  private static readonly ASR_YELLOW = 1000;
  private static readonly ASR_RED = 1500;
  private static readonly TRANSLATION_YELLOW = 400;
  private static readonly TRANSLATION_RED = 600;
  private static readonly TTS_YELLOW = 400;
  private static readonly TTS_RED = 600;
  private static readonly CHUNK_DURATION_YELLOW = 1.0; // seconds
  private static readonly CHUNK_DURATION_RED = 1.3; // seconds
  private static readonly CHUNK_SIZE_YELLOW = 200 * 1024; // 200KB
  private static readonly CHUNK_SIZE_RED = 250 * 1024; // 250KB
  private static readonly UPLOAD_YELLOW = 300;
  private static readonly UPLOAD_RED = 400;
  private static readonly E2E_YELLOW = 1000;
  private static readonly E2E_RED = 1500;

  static detect(report: Partial<DiagnosticReport>): BottleneckResult {
    const issues: { severity: Severity; message: string }[] = [];

    // Check ASR latency
    if (report.asr) {
      if (report.asr.duration > this.ASR_RED) {
        issues.push({
          severity: "red",
          message: `ASR too slow (${report.asr.duration.toFixed(0)}ms > ${this.ASR_RED}ms)`,
        });
      } else if (report.asr.duration > this.ASR_YELLOW) {
        issues.push({
          severity: "yellow",
          message: `ASR slow (${report.asr.duration.toFixed(0)}ms > ${this.ASR_YELLOW}ms)`,
        });
      }
    }

    // Check Translation latency
    if (report.translation) {
      if (report.translation.duration > this.TRANSLATION_RED) {
        issues.push({
          severity: "red",
          message: `Translation too slow (${report.translation.duration.toFixed(0)}ms > ${this.TRANSLATION_RED}ms)`,
        });
      } else if (report.translation.duration > this.TRANSLATION_YELLOW) {
        issues.push({
          severity: "yellow",
          message: `Translation slow (${report.translation.duration.toFixed(0)}ms > ${this.TRANSLATION_YELLOW}ms)`,
        });
      }
    }

    // Check TTS latency
    if (report.tts) {
      if (report.tts.duration > this.TTS_RED) {
        issues.push({
          severity: "red",
          message: `TTS too slow (${report.tts.duration.toFixed(0)}ms > ${this.TTS_RED}ms)`,
        });
      } else if (report.tts.duration > this.TTS_YELLOW) {
        issues.push({
          severity: "yellow",
          message: `TTS slow (${report.tts.duration.toFixed(0)}ms > ${this.TTS_YELLOW}ms)`,
        });
      }
    }

    // Check Chunk duration
    if (report.chunk) {
      if (report.chunk.metadata.chunkDuration > this.CHUNK_DURATION_RED) {
        issues.push({
          severity: "red",
          message: `Chunk too long (${report.chunk.metadata.chunkDuration.toFixed(2)}s > ${this.CHUNK_DURATION_RED}s)`,
        });
      } else if (report.chunk.metadata.chunkDuration > this.CHUNK_DURATION_YELLOW) {
        issues.push({
          severity: "yellow",
          message: `Chunk long (${report.chunk.metadata.chunkDuration.toFixed(2)}s > ${this.CHUNK_DURATION_YELLOW}s)`,
        });
      }

      // Check Chunk size
      const chunkSizeKB = report.chunk.metadata.chunkSize / 1024;
      if (report.chunk.metadata.chunkSize > this.CHUNK_SIZE_RED) {
        issues.push({
          severity: "red",
          message: `Chunk too large (${chunkSizeKB.toFixed(0)}KB > ${(this.CHUNK_SIZE_RED / 1024).toFixed(0)}KB)`,
        });
      } else if (report.chunk.metadata.chunkSize > this.CHUNK_SIZE_YELLOW) {
        issues.push({
          severity: "yellow",
          message: `Chunk large (${chunkSizeKB.toFixed(0)}KB > ${(this.CHUNK_SIZE_YELLOW / 1024).toFixed(0)}KB)`,
        });
      }

      // Check Upload time
      if (report.chunk.metadata.uploadTime > this.UPLOAD_RED) {
        issues.push({
          severity: "red",
          message: `Network too slow (${report.chunk.metadata.uploadTime.toFixed(0)}ms > ${this.UPLOAD_RED}ms)`,
        });
      } else if (report.chunk.metadata.uploadTime > this.UPLOAD_YELLOW) {
        issues.push({
          severity: "yellow",
          message: `Network slow (${report.chunk.metadata.uploadTime.toFixed(0)}ms > ${this.UPLOAD_YELLOW}ms)`,
        });
      }
    }

    // Check E2E latency
    if (report.e2e) {
      if (report.e2e.duration > this.E2E_RED) {
        issues.push({
          severity: "red",
          message: `E2E too slow (${report.e2e.duration.toFixed(0)}ms > ${this.E2E_RED}ms)`,
        });
      } else if (report.e2e.duration > this.E2E_YELLOW) {
        issues.push({
          severity: "yellow",
          message: `E2E slow (${report.e2e.duration.toFixed(0)}ms > ${this.E2E_YELLOW}ms)`,
        });
      }
    }

    // Determine overall severity and bottleneck
    if (issues.length === 0) {
      return {
        bottleneck: "None",
        severity: "green",
        details: ["All metrics within acceptable range"],
      };
    }

    // Find the most severe issue
    const redIssues = issues.filter((i) => i.severity === "red");
    const yellowIssues = issues.filter((i) => i.severity === "yellow");

    if (redIssues.length > 0) {
      return {
        bottleneck: redIssues[0].message.split("(")[0].trim(),
        severity: "red",
        details: issues.map((i) => i.message),
      };
    }

    return {
      bottleneck: yellowIssues[0].message.split("(")[0].trim(),
      severity: "yellow",
      details: issues.map((i) => i.message),
    };
  }
}
