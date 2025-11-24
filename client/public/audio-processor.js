// AudioWorklet processor for capturing raw PCM audio data
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4800; // 100ms at 48kHz
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0]; // Mono channel
      
      // Collect samples
      for (let i = 0; i < channelData.length; i++) {
        this.buffer.push(channelData[i]);
      }

      // Send buffer when it reaches the target size
      if (this.buffer.length >= this.bufferSize) {
        this.port.postMessage({
          type: 'audioData',
          data: new Float32Array(this.buffer)
        });
        this.buffer = [];
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
