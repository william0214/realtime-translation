package provider

import (
	"context"
	"time"
)

// ASRMode defines the mode of ASR processing
type ASRMode string

const (
	ASRModeSegment ASRMode = "segment" // Process complete audio segments
	ASRModeStream  ASRMode = "stream"  // Process audio in real-time streaming
	ASRModeHybrid  ASRMode = "hybrid"  // Combine streaming and segment processing
)

// ASRRequest contains parameters for an ASR request
type ASRRequest struct {
	AudioData      []byte                 `json:"audio_data"`       // Audio data (PCM, WAV, or other format)
	AudioFormat    string                 `json:"audio_format"`     // e.g., "pcm", "wav", "webm"
	SampleRate     int                    `json:"sample_rate"`      // e.g., 16000, 48000
	Language       string                 `json:"language,omitempty"` // ISO 639-1 code (optional, for language hint)
	Mode           ASRMode                `json:"mode"`             // segment, stream, or hybrid
	Context        RequestContext         `json:"context"`
	Options        map[string]interface{} `json:"options,omitempty"`
}

// ASRResponse contains the result of an ASR request
type ASRResponse struct {
	ProviderResponse
	Transcript       string  `json:"transcript"`
	DetectedLanguage string  `json:"detected_language"` // ISO 639-1 code
	Confidence       float64 `json:"confidence"`        // 0.0 - 1.0
	IsPartial        bool    `json:"is_partial"`        // true for streaming partial results
	IsFinal          bool    `json:"is_final"`          // true for final result
	Segments         []ASRSegment `json:"segments,omitempty"` // Word-level or phrase-level segments
}

// ASRSegment represents a segment of transcribed audio
type ASRSegment struct {
	Text       string    `json:"text"`
	StartTime  float64   `json:"start_time"`  // seconds
	EndTime    float64   `json:"end_time"`    // seconds
	Confidence float64   `json:"confidence"`
}

// ASRStreamCallback is called for each streaming result
type ASRStreamCallback func(response *ASRResponse) error

// ASRService is the interface that all ASR providers must implement
type ASRService interface {
	BaseProvider
	
	// Transcribe transcribes audio to text (segment mode)
	Transcribe(ctx context.Context, req ASRRequest) (*ASRResponse, error)
	
	// TranscribeStream transcribes audio in streaming mode
	TranscribeStream(ctx context.Context, req ASRRequest, callback ASRStreamCallback) error
	
	// TranscribeHybrid transcribes audio in hybrid mode (streaming + segment)
	// Returns partial results via callback and final result via return value
	TranscribeHybrid(ctx context.Context, req ASRRequest, callback ASRStreamCallback) (*ASRResponse, error)
	
	// GetSupportedFormats returns supported audio formats
	GetSupportedFormats() []string
	
	// GetSupportedLanguages returns supported languages
	GetSupportedLanguages() []string
}

// ASRProviderBase provides common functionality for ASR providers
type ASRProviderBase struct {
	providerType ProviderType
	name         string
	status       ProviderStatus
	metrics      ProviderMetrics
	config       ProviderConfig
}

// NewASRProviderBase creates a new ASR provider base
func NewASRProviderBase(providerType ProviderType, name string, config ProviderConfig) *ASRProviderBase {
	return &ASRProviderBase{
		providerType: providerType,
		name:         name,
		status:       StatusUnknown,
		metrics:      ProviderMetrics{},
		config:       config,
	}
}

// GetType returns the provider type
func (p *ASRProviderBase) GetType() ProviderType {
	return p.providerType
}

// GetServiceType returns the service type
func (p *ASRProviderBase) GetServiceType() ServiceType {
	return ServiceASR
}

// GetName returns the provider name
func (p *ASRProviderBase) GetName() string {
	return p.name
}

// GetStatus returns the current status
func (p *ASRProviderBase) GetStatus() ProviderStatus {
	return p.status
}

// GetMetrics returns provider metrics
func (p *ASRProviderBase) GetMetrics() ProviderMetrics {
	return p.metrics
}

// UpdateMetrics updates provider metrics
func (p *ASRProviderBase) UpdateMetrics(latency time.Duration, success bool, err error) {
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
func (p *ASRProviderBase) SetStatus(status ProviderStatus) {
	p.status = status
}
