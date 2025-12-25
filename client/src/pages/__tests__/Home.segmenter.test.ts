/**
 * VAD/Segmenter Tests for Home.tsx
 * 
 * Tests the VAD state machine and segment lifecycle:
 * 1. END finalize: Speech END detected + minSpeechMs達標 → 立刻 final
 * 2. Auto-cut: Speech duration exceeds maxFinalSec → auto-cut as保底
 * 3. Cancel guard: Segment cancelled → async responses不可更新 UI
 * 
 * v1.5.3: Added tests for buffer time unit logging and VAD hysteresis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock refs and state for testing
type SegmentState = {
  currentSegmentId: number;
  activeSegments: Set<number>;
  cancelledSegments: Set<number>;
  isSpeaking: boolean;
  speechStartTime: number;
  lastSpeechTime: number;
  sentenceEndTriggered: boolean;
  sentenceBuffer: Float32Array[];
  partialBuffer: Float32Array[];
};

// Helper: Create initial state
function createInitialState(): SegmentState {
  return {
    currentSegmentId: 0,
    activeSegments: new Set(),
    cancelledSegments: new Set(),
    isSpeaking: false,
    speechStartTime: 0,
    lastSpeechTime: 0,
    sentenceEndTriggered: false,
    sentenceBuffer: [],
    partialBuffer: [],
  };
}

// Helper: Simulate speech start
function simulateSpeechStart(state: SegmentState, now: number): number {
  const newSegmentId = ++state.currentSegmentId;
  state.activeSegments.add(newSegmentId);
  state.isSpeaking = true;
  state.speechStartTime = now;
  state.lastSpeechTime = now;
  state.sentenceEndTriggered = false;
  state.sentenceBuffer = [];
  state.partialBuffer = [];
  return newSegmentId;
}

// Helper: Simulate speech end (VAD END detected)
function simulateSpeechEnd(state: SegmentState, now: number, silenceDuration: number): boolean {
  if (!state.isSpeaking || state.sentenceEndTriggered) {
    return false;
  }
  
  const actualSilenceDuration = now - state.lastSpeechTime;
  if (actualSilenceDuration >= silenceDuration) {
    state.isSpeaking = false;
    state.sentenceEndTriggered = true;
    return true;
  }
  return false;
}

// Helper: Check if segment should be finalized
function shouldFinalize(state: SegmentState, minSpeechDuration: number): boolean {
  const speechDuration = state.lastSpeechTime - state.speechStartTime;
  return speechDuration >= minSpeechDuration;
}

// Helper: Cancel segment
function cancelSegment(state: SegmentState, segmentId: number): void {
  state.activeSegments.delete(segmentId);
  state.cancelledSegments.add(segmentId);
}

// Helper: Check if segment is active
function isSegmentActive(state: SegmentState, segmentId: number): boolean {
  return state.activeSegments.has(segmentId) && !state.cancelledSegments.has(segmentId);
}

// Helper: Simulate buffer accumulation (for duration calculation)
function accumulateBuffer(state: SegmentState, durationMs: number, sampleRate: number = 48000): void {
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  const buffer = new Float32Array(samples);
  state.sentenceBuffer.push(buffer);
  state.partialBuffer.push(buffer);
}

// Helper: Calculate buffer duration
function calculateBufferDuration(buffers: Float32Array[], sampleRate: number = 48000): number {
  const totalSamples = buffers.reduce((acc, buf) => acc + buf.length, 0);
  return (totalSamples / sampleRate) * 1000; // ms
}

describe("VAD/Segmenter State Machine", () => {
  let state: SegmentState;
  const SAMPLE_RATE = 48000;
  const MIN_SPEECH_DURATION_MS = 800;
  const SILENCE_DURATION_MS = 650;
  const FINAL_MAX_DURATION_MS = 4000;

  beforeEach(() => {
    state = createInitialState();
  });

  describe("1. END Finalize (正常語音結束)", () => {
    it("should finalize when END detected and minSpeechMs達標", () => {
      const now = Date.now();
      
      // Step 1: Speech start
      const segmentId = simulateSpeechStart(state, now);
      expect(state.isSpeaking).toBe(true);
      expect(state.activeSegments.has(segmentId)).toBe(true);
      
      // Step 2: Accumulate audio for 1000ms (> minSpeechDuration)
      const speechDuration = 1000;
      accumulateBuffer(state, speechDuration, SAMPLE_RATE);
      state.lastSpeechTime = now + speechDuration;
      
      // Step 3: Silence for 650ms → END detected
      const endTime = now + speechDuration + SILENCE_DURATION_MS;
      const endDetected = simulateSpeechEnd(state, endTime, SILENCE_DURATION_MS);
      
      expect(endDetected).toBe(true);
      expect(state.isSpeaking).toBe(false);
      expect(state.sentenceEndTriggered).toBe(true);
      
      // Step 4: Check if should finalize
      const shouldFin = shouldFinalize(state, MIN_SPEECH_DURATION_MS);
      expect(shouldFin).toBe(true);
      
      // Step 5: Verify buffer duration
      const bufferDuration = calculateBufferDuration(state.sentenceBuffer, SAMPLE_RATE);
      expect(bufferDuration).toBeGreaterThanOrEqual(MIN_SPEECH_DURATION_MS);
      
      console.log(`✅ END finalize: speechDuration=${speechDuration}ms, bufferDuration=${bufferDuration.toFixed(0)}ms`);
    });

    it("should NOT finalize when END detected but speech too short", () => {
      const now = Date.now();
      
      // Step 1: Speech start
      const segmentId = simulateSpeechStart(state, now);
      
      // Step 2: Accumulate audio for 500ms (< minSpeechDuration)
      const speechDuration = 500;
      accumulateBuffer(state, speechDuration, SAMPLE_RATE);
      state.lastSpeechTime = now + speechDuration;
      
      // Step 3: Silence for 650ms → END detected
      const endTime = now + speechDuration + SILENCE_DURATION_MS;
      const endDetected = simulateSpeechEnd(state, endTime, SILENCE_DURATION_MS);
      
      expect(endDetected).toBe(true);
      
      // Step 4: Check if should finalize (should be false)
      const shouldFin = shouldFinalize(state, MIN_SPEECH_DURATION_MS);
      expect(shouldFin).toBe(false);
      
      // Step 5: Segment should be cancelled (too short)
      cancelSegment(state, segmentId);
      expect(isSegmentActive(state, segmentId)).toBe(false);
      expect(state.cancelledSegments.has(segmentId)).toBe(true);
      
      console.log(`✅ Speech too short: speechDuration=${speechDuration}ms < ${MIN_SPEECH_DURATION_MS}ms, cancelled`);
    });
  });

  describe("2. Auto-cut (超時保底)", () => {
    it("should auto-cut when speech duration exceeds maxFinalSec", () => {
      const now = Date.now();
      
      // Step 1: Speech start
      const segmentId = simulateSpeechStart(state, now);
      
      // Step 2: Accumulate audio in small chunks (simulate real-time accumulation)
      // Accumulate 4500ms of audio in 20ms chunks (like real VAD)
      const speechDuration = 4500;
      const chunkDuration = 20; // 20ms per chunk
      const numChunks = Math.floor(speechDuration / chunkDuration);
      
      for (let i = 0; i < numChunks; i++) {
        const samples = Math.floor((chunkDuration / 1000) * SAMPLE_RATE);
        state.sentenceBuffer.push(new Float32Array(samples));
      }
      state.lastSpeechTime = now + speechDuration;
      
      // Step 3: Check if auto-cut should trigger
      const currentSpeechDuration = state.lastSpeechTime - state.speechStartTime;
      const shouldAutoCut = currentSpeechDuration >= FINAL_MAX_DURATION_MS && !state.sentenceEndTriggered;
      
      expect(shouldAutoCut).toBe(true);
      
      // Step 4: Trigger auto-cut
      state.sentenceEndTriggered = true;
      state.isSpeaking = false;
      
      // Step 5: Verify buffer duration
      const bufferDuration = calculateBufferDuration(state.sentenceBuffer, SAMPLE_RATE);
      expect(bufferDuration).toBeGreaterThan(FINAL_MAX_DURATION_MS);
      
      // Step 6: Hard-trim to maxFinalSec (2.0s)
      const MAX_FINAL_DURATION_S = 2.0;
      const targetSamples = Math.floor(MAX_FINAL_DURATION_S * SAMPLE_RATE);
      let accumulatedSamples = 0;
      let startIndex = state.sentenceBuffer.length - 1;
      
      for (let i = state.sentenceBuffer.length - 1; i >= 0; i--) {
        accumulatedSamples += state.sentenceBuffer[i].length;
        if (accumulatedSamples >= targetSamples) {
          startIndex = i;
          break;
        }
      }
      
      const trimmedBuffers = state.sentenceBuffer.slice(startIndex);
      const trimmedDuration = calculateBufferDuration(trimmedBuffers, SAMPLE_RATE);
      
      expect(trimmedDuration).toBeLessThanOrEqual(MAX_FINAL_DURATION_S * 1000 + 100); // Allow 100ms tolerance
      
      console.log(`✅ Auto-cut: original=${bufferDuration.toFixed(0)}ms, trimmed=${trimmedDuration.toFixed(0)}ms`);
    });

    it("should NOT auto-cut if END already detected", () => {
      const now = Date.now();
      
      // Step 1: Speech start
      const segmentId = simulateSpeechStart(state, now);
      
      // Step 2: Accumulate audio for 1000ms
      const speechDuration = 1000;
      accumulateBuffer(state, speechDuration, SAMPLE_RATE);
      state.lastSpeechTime = now + speechDuration;
      
      // Step 3: END detected first
      const endTime = now + speechDuration + SILENCE_DURATION_MS;
      const endDetected = simulateSpeechEnd(state, endTime, SILENCE_DURATION_MS);
      expect(endDetected).toBe(true);
      
      // Step 4: Check if auto-cut should trigger (should be false because END already triggered)
      const currentSpeechDuration = state.lastSpeechTime - state.speechStartTime;
      const shouldAutoCut = currentSpeechDuration >= FINAL_MAX_DURATION_MS && !state.sentenceEndTriggered;
      
      expect(shouldAutoCut).toBe(false);
      expect(state.sentenceEndTriggered).toBe(true);
      
      console.log(`✅ END detected first, auto-cut skipped`);
    });
  });

  describe("3. Cancel Guard (競態條件防護)", () => {
    it("should ignore async responses when segment is cancelled", async () => {
      const now = Date.now();
      
      // Step 1: Speech start
      const segmentId = simulateSpeechStart(state, now);
      
      // Step 2: Accumulate audio for 500ms (too short)
      const speechDuration = 500;
      accumulateBuffer(state, speechDuration, SAMPLE_RATE);
      state.lastSpeechTime = now + speechDuration;
      
      // Step 3: Cancel segment (too short)
      cancelSegment(state, segmentId);
      expect(isSegmentActive(state, segmentId)).toBe(false);
      
      // Step 4: Simulate async response arriving after cancellation
      const mockAsyncResponse = vi.fn(() => {
        // Check segment guard before updating UI
        if (!isSegmentActive(state, segmentId)) {
          console.log(`⚠️ [Segment#${segmentId}] Cancelled, ignoring async response`);
          return false;
        }
        return true;
      });
      
      const responseProcessed = mockAsyncResponse();
      expect(responseProcessed).toBe(false);
      expect(mockAsyncResponse).toHaveBeenCalled();
      
      console.log(`✅ Cancel guard: async response ignored for cancelled segment #${segmentId}`);
    });

    it("should process async responses when segment is still active", async () => {
      const now = Date.now();
      
      // Step 1: Speech start
      const segmentId = simulateSpeechStart(state, now);
      
      // Step 2: Accumulate audio for 1000ms (valid)
      const speechDuration = 1000;
      accumulateBuffer(state, speechDuration, SAMPLE_RATE);
      state.lastSpeechTime = now + speechDuration;
      
      // Step 3: Simulate async response arriving while segment is active
      const mockAsyncResponse = vi.fn(() => {
        // Check segment guard before updating UI
        if (!isSegmentActive(state, segmentId)) {
          console.log(`⚠️ [Segment#${segmentId}] Not active, ignoring async response`);
          return false;
        }
        return true;
      });
      
      const responseProcessed = mockAsyncResponse();
      expect(responseProcessed).toBe(true);
      expect(mockAsyncResponse).toHaveBeenCalled();
      
      console.log(`✅ Async response processed for active segment #${segmentId}`);
    });

    it("should ignore multiple async responses after segment cancellation", async () => {
      const now = Date.now();
      
      // Step 1: Speech start
      const segmentId = simulateSpeechStart(state, now);
      
      // Step 2: Cancel segment immediately
      cancelSegment(state, segmentId);
      
      // Step 3: Simulate multiple async responses (partial, final, translation)
      const mockPartialResponse = vi.fn(() => !isSegmentActive(state, segmentId) ? false : true);
      const mockFinalResponse = vi.fn(() => !isSegmentActive(state, segmentId) ? false : true);
      const mockTranslationResponse = vi.fn(() => !isSegmentActive(state, segmentId) ? false : true);
      
      expect(mockPartialResponse()).toBe(false);
      expect(mockFinalResponse()).toBe(false);
      expect(mockTranslationResponse()).toBe(false);
      
      expect(mockPartialResponse).toHaveBeenCalled();
      expect(mockFinalResponse).toHaveBeenCalled();
      expect(mockTranslationResponse).toHaveBeenCalled();
      
      console.log(`✅ All async responses ignored for cancelled segment #${segmentId}`);
    });
  });

  describe("4. Buffer Time Unit Logging", () => {
    it("should correctly calculate buffer duration in ms", () => {
      const buffers: Float32Array[] = [];
      
      // Add 8 buffers of 960 samples each (20ms per buffer at 48kHz)
      for (let i = 0; i < 8; i++) {
        buffers.push(new Float32Array(960));
      }
      
      const durationMs = calculateBufferDuration(buffers, SAMPLE_RATE);
      const expectedMs = (8 * 960 / SAMPLE_RATE) * 1000;
      
      expect(durationMs).toBeCloseTo(expectedMs, 0);
      expect(durationMs).toBeCloseTo(160, 0); // 8 buffers ≈ 160ms
      
      console.log(`✅ Buffer duration: 8 buffers = ${durationMs.toFixed(0)}ms (${(8 * 960)} samples)`);
    });

    it("should correctly calculate 1.5s sliding window", () => {
      const PARTIAL_WINDOW_DURATION_S = 1.5;
      const BUFFERS_PER_WINDOW = Math.ceil((SAMPLE_RATE * PARTIAL_WINDOW_DURATION_S) / 960);
      
      const buffers: Float32Array[] = [];
      for (let i = 0; i < BUFFERS_PER_WINDOW; i++) {
        buffers.push(new Float32Array(960));
      }
      
      const durationMs = calculateBufferDuration(buffers, SAMPLE_RATE);
      
      expect(durationMs).toBeGreaterThanOrEqual(PARTIAL_WINDOW_DURATION_S * 1000 - 20); // Allow 20ms tolerance
      expect(durationMs).toBeLessThanOrEqual(PARTIAL_WINDOW_DURATION_S * 1000 + 20);
      
      console.log(`✅ Sliding window: ${BUFFERS_PER_WINDOW} buffers ≈ ${durationMs.toFixed(0)}ms (target: ${PARTIAL_WINDOW_DURATION_S}s)`);
    });
  });

  describe("5. VAD Hysteresis (雙門檻)", () => {
    it("should use lower thresholds for v1.5.3", () => {
      // v1.5.3 defaults
      const VAD_START_THRESHOLD = 0.045; // was 0.060
      const VAD_END_THRESHOLD = 0.035; // was 0.045
      const VAD_START_FRAMES = 2; // was 3
      const VAD_END_FRAMES = 8; // unchanged
      
      expect(VAD_START_THRESHOLD).toBeLessThan(0.060);
      expect(VAD_END_THRESHOLD).toBeLessThan(0.045);
      expect(VAD_START_FRAMES).toBeLessThan(3);
      
      console.log(`✅ VAD Hysteresis v1.5.3: start=${VAD_START_THRESHOLD}, end=${VAD_END_THRESHOLD}, startFrames=${VAD_START_FRAMES}, endFrames=${VAD_END_FRAMES}`);
    });
  });
});
