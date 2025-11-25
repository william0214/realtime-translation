/**
 * Translation Profiler
 * Measures translation API latency and performance
 */

export interface TranslationProfileResult {
  startTime: number;
  endTime: number;
  duration: number; // ms
  metadata: {
    model: string;
    textLength: number; // characters
    sourceLang: string;
    targetLang: string;
  };
}

export class TranslationProfiler {
  private startTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(
    text: string,
    sourceLang: string,
    targetLang: string,
    model: string = "gpt-4o-mini"
  ): TranslationProfileResult {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    return {
      startTime: this.startTime,
      endTime,
      duration,
      metadata: {
        model,
        textLength: text.length,
        sourceLang,
        targetLang,
      },
    };
  }
}
