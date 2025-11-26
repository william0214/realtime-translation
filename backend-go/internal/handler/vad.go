package handler

import (
	"math"
	"time"
)

// VADDetector implements Voice Activity Detection
type VADDetector struct {
	// Configuration
	rmsThreshold      float64       // RMS energy threshold
	silenceDuration   time.Duration // Duration of silence to consider speech ended
	minSpeechDuration time.Duration // Minimum speech duration to avoid false positives
	
	// State
	lastSpeechTime time.Time
	isSpeaking     bool
}

// NewVADDetector creates a new VAD detector with default settings
func NewVADDetector() *VADDetector {
	return &VADDetector{
		rmsThreshold:      0.08,               // Higher threshold to filter background noise
		silenceDuration:   1000 * time.Millisecond, // 1 second of silence
		minSpeechDuration: 300 * time.Millisecond,  // 300ms minimum speech
		lastSpeechTime:    time.Now(),
		isSpeaking:        false,
	}
}

// NewVADDetectorWithConfig creates a new VAD detector with custom settings
func NewVADDetectorWithConfig(rmsThreshold float64, silenceDuration, minSpeechDuration time.Duration) *VADDetector {
	return &VADDetector{
		rmsThreshold:      rmsThreshold,
		silenceDuration:   silenceDuration,
		minSpeechDuration: minSpeechDuration,
		lastSpeechTime:    time.Now(),
		isSpeaking:        false,
	}
}

// DetectSpeech detects if the audio chunk contains speech
func (v *VADDetector) DetectSpeech(audioData []byte, sampleRate int) bool {
	// Calculate RMS energy
	rms := v.calculateRMS(audioData)
	
	// Check if RMS exceeds threshold
	isSpeech := rms > v.rmsThreshold
	
	if isSpeech {
		v.lastSpeechTime = time.Now()
		v.isSpeaking = true
		return true
	}
	
	// Check if silence duration exceeded
	silenceDuration := time.Since(v.lastSpeechTime)
	if v.isSpeaking && silenceDuration > v.silenceDuration {
		v.isSpeaking = false
		return false
	}
	
	return v.isSpeaking
}

// calculateRMS calculates the Root Mean Square energy of audio data
func (v *VADDetector) calculateRMS(audioData []byte) float64 {
	if len(audioData) == 0 {
		return 0
	}
	
	// Convert bytes to 16-bit PCM samples
	samples := v.bytesToInt16(audioData)
	
	if len(samples) == 0 {
		return 0
	}
	
	// Calculate RMS
	var sum float64
	for _, sample := range samples {
		normalized := float64(sample) / 32768.0 // Normalize to [-1, 1]
		sum += normalized * normalized
	}
	
	rms := math.Sqrt(sum / float64(len(samples)))
	
	return rms
}

// bytesToInt16 converts byte array to int16 array (16-bit PCM)
func (v *VADDetector) bytesToInt16(data []byte) []int16 {
	if len(data)%2 != 0 {
		// Ensure even number of bytes
		data = data[:len(data)-1]
	}
	
	samples := make([]int16, len(data)/2)
	for i := 0; i < len(samples); i++ {
		// Little-endian 16-bit PCM
		samples[i] = int16(data[i*2]) | int16(data[i*2+1])<<8
	}
	
	return samples
}

// Reset resets the VAD detector state
func (v *VADDetector) Reset() {
	v.lastSpeechTime = time.Now()
	v.isSpeaking = false
}

// SetThreshold sets the RMS threshold
func (v *VADDetector) SetThreshold(threshold float64) {
	v.rmsThreshold = threshold
}

// SetSilenceDuration sets the silence duration
func (v *VADDetector) SetSilenceDuration(duration time.Duration) {
	v.silenceDuration = duration
}

// SetMinSpeechDuration sets the minimum speech duration
func (v *VADDetector) SetMinSpeechDuration(duration time.Duration) {
	v.minSpeechDuration = duration
}

// IsSpeaking returns whether speech is currently detected
func (v *VADDetector) IsSpeaking() bool {
	return v.isSpeaking
}

// GetLastSpeechTime returns the last time speech was detected
func (v *VADDetector) GetLastSpeechTime() time.Time {
	return v.lastSpeechTime
}
