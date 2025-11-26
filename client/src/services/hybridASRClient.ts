/**
 * HybridASRClient - WebSocket client for Hybrid ASR mode
 * 
 * Features:
 * - Real-time audio streaming
 * - Partial transcript (immediate subtitles)
 * - Final transcript (complete translation + TTS)
 * - Configurable VAD parameters
 */

export interface PartialTranscriptResponse {
  type: 'partial_transcript';
  transcript: string;
  confidence: number;
  is_partial: boolean;
  timestamp: string;
  latency_ms: number;
}

export interface FinalTranscriptResponse {
  type: 'final_transcript';
  transcript: string;
  detected_lang: string;
  translation: string;
  target_lang: string;
  tts_audio_data: string; // Base64 encoded
  timestamp: string;
  asr_latency_ms: number;
  trans_latency_ms: number;
  tts_latency_ms: number;
  total_latency_ms: number;
}

export interface ErrorResponse {
  type: 'error';
  error: string;
}

export interface VADConfig {
  mode?: 'segment' | 'stream' | 'hybrid';
  source_lang?: string;
  target_lang?: string;
  vad_threshold?: number;
  silence_duration?: number;
}

export type ASRResponse = PartialTranscriptResponse | FinalTranscriptResponse | ErrorResponse;

export class HybridASRClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private clientId: string;
  private mode: 'segment' | 'stream' | 'hybrid';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Callbacks
  public onPartialTranscript: ((data: PartialTranscriptResponse) => void) | null = null;
  public onFinalTranscript: ((data: FinalTranscriptResponse) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onConnected: (() => void) | null = null;
  public onDisconnected: (() => void) | null = null;

  constructor(
    serverUrl: string,
    clientId: string = 'default',
    mode: 'segment' | 'stream' | 'hybrid' = 'hybrid'
  ) {
    this.serverUrl = serverUrl;
    this.clientId = clientId;
    this.mode = mode;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.serverUrl}?client_id=${this.clientId}&mode=${this.mode}`;
        console.log('[HybridASR] Connecting to:', url);
        
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('[HybridASR] Connected');
          this.reconnectAttempts = 0;
          if (this.onConnected) {
            this.onConnected();
          }
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data: ASRResponse = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[HybridASR] Failed to parse message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[HybridASR] WebSocket error:', error);
          if (this.onError) {
            this.onError('WebSocket connection error');
          }
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('[HybridASR] Disconnected');
          if (this.onDisconnected) {
            this.onDisconnected();
          }
          
          // Auto-reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[HybridASR] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
              this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        console.error('[HybridASR] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send audio chunk to server
   */
  sendAudioChunk(audioData: ArrayBuffer, sampleRate: number = 48000, format: string = 'webm'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[HybridASR] WebSocket not connected');
      return;
    }

    // Convert ArrayBuffer to Base64
    const base64Audio = this.arrayBufferToBase64(audioData);

    const message = {
      type: 'audio_chunk',
      audio_data: base64Audio,
      sample_rate: sampleRate,
      format: format,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Update configuration
   */
  updateConfig(config: VADConfig): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[HybridASR] WebSocket not connected');
      return;
    }

    const message = {
      type: 'config',
      config: config,
    };

    console.log('[HybridASR] Updating config:', config);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Stop processing
   */
  stop(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = { type: 'stop' };
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: ASRResponse): void {
    switch (data.type) {
      case 'partial_transcript':
        console.log('[HybridASR] Partial:', data.transcript, `(${data.latency_ms}ms)`);
        if (this.onPartialTranscript) {
          this.onPartialTranscript(data);
        }
        break;

      case 'final_transcript':
        console.log('[HybridASR] Final:', data.transcript, '→', data.translation, `(${data.total_latency_ms}ms)`);
        if (this.onFinalTranscript) {
          this.onFinalTranscript(data);
        }
        break;

      case 'error':
        console.error('[HybridASR] Error:', data.error);
        if (this.onError) {
          this.onError(data.error);
        }
        break;

      default:
        console.warn('[HybridASR] Unknown message type:', data);
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer
   */
  public base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Play audio from Base64 data
   */
  public playAudio(base64Audio: string): void {
    try {
      const audioData = this.base64ToArrayBuffer(base64Audio);
      const blob = new Blob([audioData], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
      
      audio.play().catch(error => {
        console.error('[HybridASR] Failed to play audio:', error);
      });
    } catch (error) {
      console.error('[HybridASR] Failed to decode audio:', error);
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
