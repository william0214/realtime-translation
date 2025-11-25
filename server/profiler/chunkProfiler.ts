/**
 * Chunk Profiler
 * Measures audio chunk size and duration
 */

export interface ChunkProfileResult {
  startTime: number;
  endTime: number;
  duration: number; // ms (processing time)
  metadata: {
    pcmFrameCount: number;
    chunkDuration: number; // seconds (audio duration)
    chunkSize: number; // bytes
    uploadTime: number; // ms
  };
}

export class ChunkProfiler {
  private startTime: number = 0;
  private uploadStartTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  startUpload(): void {
    this.uploadStartTime = performance.now();
  }

  end(pcmFrameCount: number, chunkDuration: number, chunkSize: number): ChunkProfileResult {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    const uploadTime = this.uploadStartTime > 0 ? endTime - this.uploadStartTime : 0;

    return {
      startTime: this.startTime,
      endTime,
      duration,
      metadata: {
        pcmFrameCount,
        chunkDuration,
        chunkSize,
        uploadTime,
      },
    };
  }
}
