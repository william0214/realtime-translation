package provider

import (
	"context"
	"time"
)

// TTSRequest contains parameters for a TTS request
type TTSRequest struct {
	Text       string                 `json:"text"`
	Language   string                 `json:"language"`    // ISO 639-1 code
	Voice      string                 `json:"voice,omitempty"` // Optional: specific voice to use
	Speed      float64                `json:"speed,omitempty"` // 0.5 - 2.0 (1.0 = normal)
	Pitch      float64                `json:"pitch,omitempty"` // 0.5 - 2.0 (1.0 = normal)
	Format     string                 `json:"format,omitempty"` // e.g., "mp3", "wav", "ogg"
	Context    RequestContext         `json:"context"`
	Options    map[string]interface{} `json:"options,omitempty"`
}

// TTSResponse contains the result of a TTS request
type TTSResponse struct {
	ProviderResponse
	AudioData  []byte  `json:"audio_data,omitempty"` // Audio data (if inline)
	AudioURL   string  `json:"audio_url,omitempty"`  // URL to audio file (if stored)
	Format     string  `json:"format"`               // Audio format
	Duration   float64 `json:"duration"`             // Duration in seconds
	Voice      string  `json:"voice,omitempty"`      // Voice used
}

// VoiceInfo contains information about a TTS voice
type VoiceInfo struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Language string   `json:"language"`
	Gender   string   `json:"gender,omitempty"` // "male", "female", "neutral"
	Styles   []string `json:"styles,omitempty"` // e.g., ["friendly", "professional", "calm"]
}

// TTSService is the interface that all TTS providers must implement
type TTSService interface {
	BaseProvider
	
	// Synthesize converts text to speech
	Synthesize(ctx context.Context, req TTSRequest) (*TTSResponse, error)
	
	// GetVoices returns available voices
	GetVoices(language string) ([]VoiceInfo, error)
	
	// GetSupportedLanguages returns supported languages
	GetSupportedLanguages() []string
	
	// GetSupportedFormats returns supported audio formats
	GetSupportedFormats() []string
	
	// GetCostPerRequest returns the estimated cost per request
	GetCostPerRequest(text string) float64
}

// TTSProviderBase provides common functionality for TTS providers
type TTSProviderBase struct {
	providerType ProviderType
	name         string
	status       ProviderStatus
	metrics      ProviderMetrics
	config       ProviderConfig
}

// NewTTSProviderBase creates a new TTS provider base
func NewTTSProviderBase(providerType ProviderType, name string, config ProviderConfig) *TTSProviderBase {
	return &TTSProviderBase{
		providerType: providerType,
		name:         name,
		status:       StatusUnknown,
		metrics:      ProviderMetrics{},
		config:       config,
	}
}

// GetType returns the provider type
func (p *TTSProviderBase) GetType() ProviderType {
	return p.providerType
}

// GetServiceType returns the service type
func (p *TTSProviderBase) GetServiceType() ServiceType {
	return ServiceTTS
}

// GetName returns the provider name
func (p *TTSProviderBase) GetName() string {
	return p.name
}

// GetStatus returns the current status
func (p *TTSProviderBase) GetStatus() ProviderStatus {
	return p.status
}

// GetMetrics returns provider metrics
func (p *TTSProviderBase) GetMetrics() ProviderMetrics {
	return p.metrics
}

// UpdateMetrics updates provider metrics
func (p *TTSProviderBase) UpdateMetrics(latency time.Duration, success bool, err error) {
	p.metrics.RequestCount++
	p.metrics.LastRequestTime = time.Now()
	
	if success {
		p.metrics.SuccessCount++
		p.status = StatusHealthy
	} else {
		p.metrics.FailureCount++
		if err != nil {
			p.metrics.LastError = err.Error()
		}
		
		// Update status based on error rate
		errorRate := float64(p.metrics.FailureCount) / float64(p.metrics.RequestCount)
		if errorRate > 0.5 {
			p.status = StatusUnhealthy
		} else if errorRate > 0.1 {
			p.status = StatusDegraded
		}
	}
	
	p.metrics.TotalLatencyMs += latency.Milliseconds()
	if p.metrics.SuccessCount > 0 {
		p.metrics.AverageLatency = time.Duration(p.metrics.TotalLatencyMs/p.metrics.SuccessCount) * time.Millisecond
	}
}

// SetStatus sets the provider status
func (p *TTSProviderBase) SetStatus(status ProviderStatus) {
	p.status = status
}
