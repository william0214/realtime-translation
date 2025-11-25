/**
 * E2E (End-to-End) Profiler
 * Measures total latency from speech start to translation display
 */

export interface E2EProfileResult {
  startTime: number;
  endTime: number;
  duration: number; // ms
  metadata: {
    stage: string; // "VAD start" -> "Translation complete"
  };
}

export class E2EProfiler {
  private startTime: number = 0;

  start(stage: string = "VAD start"): void {
    this.startTime = performance.now();
    console.log(`[E2E Profiler] Start: ${stage}`);
  }

  end(stage: string = "Translation complete"): E2EProfileResult {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    console.log(`[E2E Profiler] End: ${stage}, Duration: ${duration.toFixed(2)}ms`);

    return {
      startTime: this.startTime,
      endTime,
      duration,
      metadata: {
        stage,
      },
    };
  }
}
