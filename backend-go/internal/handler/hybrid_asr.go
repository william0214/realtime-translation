package handler

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"realtime-translation-backend/internal/provider"
)

// HybridASRMode defines the ASR mode
type HybridASRMode string

const (
	ModeSegment HybridASRMode = "segment" // Traditional segment-based ASR
	ModeStream  HybridASRMode = "stream"  // Streaming ASR only
	ModeHybrid  HybridASRMode = "hybrid"  // Hybrid: streaming + segment
)

// HybridASRHandler handles hybrid ASR processing
type HybridASRHandler struct {
	providerManager *provider.ProviderManager
	clientID        string
	mode            HybridASRMode
	
	// Audio chunk accumulator
	audioChunks     [][]byte
	audioMutex      sync.Mutex
	totalAudioBytes int
	
	// VAD state
	vadDetector     *VADDetector
	isSpeaking      bool
	speechStartTime time.Time
	
	// Callbacks
	onPartialTranscript func(PartialTranscriptResponse)
	onFinalTranscript   func(FinalTranscriptResponse)
	onError             func(error)
	
	// Context and cancellation
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// PartialTranscriptResponse represents a partial transcript (streaming)
type PartialTranscriptResponse struct {
	Transcript  string    `json:"transcript"`
	Confidence  float64   `json:"confidence"`
	IsPartial   bool      `json:"is_partial"`
	Timestamp   time.Time `json:"timestamp"`
	LatencyMs   int64     `json:"latency_ms"`
}

// FinalTranscriptResponse represents a final transcript with translation and TTS
type FinalTranscriptResponse struct {
	Transcript      string    `json:"transcript"`
	DetectedLang    string    `json:"detected_lang"`
	Translation     string    `json:"translation"`
	TargetLang      string    `json:"target_lang"`
	TTSAudioURL     string    `json:"tts_audio_url,omitempty"`
	TTSAudioData    []byte    `json:"-"` // Not sent in JSON, handled separately
	Timestamp       time.Time `json:"timestamp"`
	ASRLatencyMs    int64     `json:"asr_latency_ms"`
	TransLatencyMs  int64     `json:"trans_latency_ms"`
	TTSLatencyMs    int64     `json:"tts_latency_ms"`
	TotalLatencyMs  int64     `json:"total_latency_ms"`
}

// NewHybridASRHandler creates a new hybrid ASR handler
func NewHybridASRHandler(
	providerManager *provider.ProviderManager,
	clientID string,
	mode HybridASRMode,
) *HybridASRHandler {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &HybridASRHandler{
		providerManager: providerManager,
		clientID:        clientID,
		mode:            mode,
		audioChunks:     make([][]byte, 0),
		vadDetector:     NewVADDetector(),
		ctx:             ctx,
		cancel:          cancel,
	}
}

// SetCallbacks sets the callback functions
func (h *HybridASRHandler) SetCallbacks(
	onPartial func(PartialTranscriptResponse),
	onFinal func(FinalTranscriptResponse),
	onError func(error),
) {
	h.onPartialTranscript = onPartial
	h.onFinalTranscript = onFinal
	h.onError = onError
}

// ProcessAudioChunk processes an incoming audio chunk
func (h *HybridASRHandler) ProcessAudioChunk(chunk []byte, sampleRate int, format string) error {
	// Add chunk to accumulator
	h.audioMutex.Lock()
	h.audioChunks = append(h.audioChunks, chunk)
	h.totalAudioBytes += len(chunk)
	h.audioMutex.Unlock()
	
	// VAD detection
	isSpeech := h.vadDetector.DetectSpeech(chunk, sampleRate)
	
	if isSpeech && !h.isSpeaking {
		// Speech started
		h.isSpeaking = true
		h.speechStartTime = time.Now()
		log.Printf("[HybridASR] Speech started")
	}
	
	// Process based on mode
	switch h.mode {
	case ModeSegment:
		// Segment mode: wait for VAD to detect end of speech
		if !isSpeech && h.isSpeaking {
			h.handleSpeechEnd(sampleRate, format)
		}
		
	case ModeStream:
		// Stream mode: process immediately for partial transcript
		h.wg.Add(1)
		go h.processPartialTranscript(chunk, sampleRate, format)
		
	case ModeHybrid:
		// Hybrid mode: both partial and final
		
		// 1. Process partial transcript (non-blocking)
		h.wg.Add(1)
		go h.processPartialTranscript(chunk, sampleRate, format)
		
		// 2. Check for speech end to trigger final transcript
		if !isSpeech && h.isSpeaking {
			h.handleSpeechEnd(sampleRate, format)
		}
	}
	
	return nil
}

// handleSpeechEnd handles the end of speech detection
func (h *HybridASRHandler) handleSpeechEnd(sampleRate int, format string) {
	h.isSpeaking = false
	speechDuration := time.Since(h.speechStartTime)
	
	log.Printf("[HybridASR] Speech ended, duration: %v", speechDuration)
	
	// Check minimum speech duration (300ms)
	if speechDuration < 300*time.Millisecond {
		log.Printf("[HybridASR] Speech too short, discarding")
		h.clearAudioBuffer()
		return
	}
	
	// Process final transcript (non-blocking)
	h.wg.Add(1)
	go h.processFinalTranscript(sampleRate, format)
}

// processPartialTranscript processes a partial transcript using streaming ASR
func (h *HybridASRHandler) processPartialTranscript(chunk []byte, sampleRate int, format string) {
	defer h.wg.Done()
	
	startTime := time.Now()
	
	// Call streaming ASR (pseudo-streaming using segment ASR)
	req := provider.ASRRequest{
		AudioData:   chunk,
		AudioFormat: format,
		SampleRate:  sampleRate,
		Mode:        provider.ASRModeSegment, // Use segment for now
		Context: provider.RequestContext{
			ClientID: h.clientID,
		},
	}
	
	resp, err := h.providerManager.Transcribe(h.ctx, req)
	if err != nil {
		if h.onError != nil {
			h.onError(fmt.Errorf("partial ASR failed: %w", err))
		}
		return
	}
	
	latency := time.Since(startTime)
	
	// Send partial transcript
	if h.onPartialTranscript != nil && resp.Transcript != "" {
		h.onPartialTranscript(PartialTranscriptResponse{
			Transcript: resp.Transcript,
			Confidence: resp.Confidence,
			IsPartial:  true,
			Timestamp:  time.Now(),
			LatencyMs:  latency.Milliseconds(),
		})
	}
}

// processFinalTranscript processes the final transcript with translation and TTS
func (h *HybridASRHandler) processFinalTranscript(sampleRate int, format string) {
	defer h.wg.Done()
	
	totalStartTime := time.Now()
	
	// Get accumulated audio
	h.audioMutex.Lock()
	audioData := h.concatenateAudioChunks()
	h.audioMutex.Unlock()
	
	if len(audioData) == 0 {
		log.Printf("[HybridASR] No audio data to process")
		return
	}
	
	log.Printf("[HybridASR] Processing final transcript, audio size: %d bytes", len(audioData))
	
	// Step 1: ASR (Segment mode for accuracy)
	asrStartTime := time.Now()
	
	asrReq := provider.ASRRequest{
		AudioData:   audioData,
		AudioFormat: format,
		SampleRate:  sampleRate,
		Mode:        provider.ASRModeSegment,
		Context: provider.RequestContext{
			ClientID: h.clientID,
		},
	}
	
	asrResp, err := h.providerManager.Transcribe(h.ctx, asrReq)
	if err != nil {
		if h.onError != nil {
			h.onError(fmt.Errorf("final ASR failed: %w", err))
		}
		h.clearAudioBuffer()
		return
	}
	
	asrLatency := time.Since(asrStartTime)
	log.Printf("[HybridASR] ASR completed: %s (latency: %v)", asrResp.Transcript, asrLatency)
	
	// Step 2: Translation
	transStartTime := time.Now()
	
	transReq := provider.TranslationRequest{
		Text:       asrResp.Transcript,
		SourceLang: asrResp.DetectedLanguage,
		TargetLang: h.getTargetLanguage(asrResp.DetectedLanguage),
		Context: provider.RequestContext{
			ClientID: h.clientID,
		},
	}
	
	transResp, err := h.providerManager.Translate(h.ctx, transReq)
	if err != nil {
		if h.onError != nil {
			h.onError(fmt.Errorf("translation failed: %w", err))
		}
		h.clearAudioBuffer()
		return
	}
	
	transLatency := time.Since(transStartTime)
	log.Printf("[HybridASR] Translation completed: %s (latency: %v)", transResp.TranslatedText, transLatency)
	
	// Step 3: TTS
	ttsStartTime := time.Now()
	
	ttsReq := provider.TTSRequest{
		Text:     transResp.TranslatedText,
		Language: transResp.TargetLang,
		Voice:    h.getVoiceForLanguage(transResp.TargetLang),
		Context: provider.RequestContext{
			ClientID: h.clientID,
		},
	}
	
	ttsResp, err := h.providerManager.Synthesize(h.ctx, ttsReq)
	if err != nil {
		if h.onError != nil {
			h.onError(fmt.Errorf("TTS failed: %w", err))
		}
		h.clearAudioBuffer()
		return
	}
	
	ttsLatency := time.Since(ttsStartTime)
	log.Printf("[HybridASR] TTS completed: %d bytes (latency: %v)", len(ttsResp.AudioData), ttsLatency)
	
	totalLatency := time.Since(totalStartTime)
	
	// Send final transcript
	if h.onFinalTranscript != nil {
		h.onFinalTranscript(FinalTranscriptResponse{
			Transcript:     asrResp.Transcript,
			DetectedLang:   asrResp.DetectedLanguage,
			Translation:    transResp.TranslatedText,
			TargetLang:     transResp.TargetLang,
			TTSAudioData:   ttsResp.AudioData,
			Timestamp:      time.Now(),
			ASRLatencyMs:   asrLatency.Milliseconds(),
			TransLatencyMs: transLatency.Milliseconds(),
			TTSLatencyMs:   ttsLatency.Milliseconds(),
			TotalLatencyMs: totalLatency.Milliseconds(),
		})
	}
	
	log.Printf("[HybridASR] Final transcript completed (total latency: %v)", totalLatency)
	
	// Clear audio buffer
	h.clearAudioBuffer()
}

// concatenateAudioChunks concatenates all audio chunks
func (h *HybridASRHandler) concatenateAudioChunks() []byte {
	if len(h.audioChunks) == 0 {
		return nil
	}
	
	result := make([]byte, 0, h.totalAudioBytes)
	for _, chunk := range h.audioChunks {
		result = append(result, chunk...)
	}
	
	return result
}

// clearAudioBuffer clears the audio buffer
func (h *HybridASRHandler) clearAudioBuffer() {
	h.audioMutex.Lock()
	defer h.audioMutex.Unlock()
	
	h.audioChunks = make([][]byte, 0)
	h.totalAudioBytes = 0
}

// getTargetLanguage determines the target language based on source language
func (h *HybridASRHandler) getTargetLanguage(sourceLang string) string {
	// Simple logic: if source is Chinese, translate to English; otherwise to Chinese
	if sourceLang == "zh" || sourceLang == "zh-TW" || sourceLang == "zh-CN" {
		return "en"
	}
	return "zh"
}

// getVoiceForLanguage returns the appropriate voice for the target language
func (h *HybridASRHandler) getVoiceForLanguage(lang string) string {
	switch lang {
	case "en":
		return "alloy"
	case "zh", "zh-TW", "zh-CN":
		return "nova"
	case "es":
		return "echo"
	case "fr":
		return "shimmer"
	default:
		return "alloy"
	}
}

// Stop stops the handler and waits for all goroutines to finish
func (h *HybridASRHandler) Stop() {
	h.cancel()
	h.wg.Wait()
	log.Printf("[HybridASR] Handler stopped")
}
