/**
 * ASR (Automatic Speech Recognition) Profiler
 * Measures Whisper API latency and performance
 */

export interface ASRProfileResult {
  startTime: number;
  endTime: number;
  duration: number; // ms
  metadata: {
    audioDuration: number; // seconds
    fileSize: number; // bytes
    model: string;
  };
}

export class ASRProfiler {
  private startTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(audioDuration: number, fileSize: number, model: string = "whisper-1"): ASRProfileResult {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    return {
      startTime: this.startTime,
      endTime,
      duration,
      metadata: {
        audioDuration,
        fileSize,
        model,
      },
    };
  }
}
