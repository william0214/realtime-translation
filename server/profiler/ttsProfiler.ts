/**
 * TTS (Text-to-Speech) Profiler
 * Measures TTS API latency and performance
 */

export interface TTSProfileResult {
  startTime: number;
  endTime: number;
  duration: number; // ms
  metadata: {
    textLength: number; // characters
    audioDuration: number; // seconds (estimated)
    model: string;
  };
}

export class TTSProfiler {
  private startTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(text: string, audioDuration: number = 0, model: string = "tts-1"): TTSProfileResult {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    return {
      startTime: this.startTime,
      endTime,
      duration,
      metadata: {
        textLength: text.length,
        audioDuration,
        model,
      },
    };
  }
}
