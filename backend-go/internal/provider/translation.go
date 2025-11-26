package provider

import (
	"context"
	"time"
)

// TranslationRequest contains parameters for a translation request
type TranslationRequest struct {
	Text       string                 `json:"text"`
	SourceLang string                 `json:"source_lang"` // ISO 639-1 code (e.g., "zh", "en", "vi")
	TargetLang string                 `json:"target_lang"` // ISO 639-1 code
	Model      string                 `json:"model,omitempty"` // Optional: specific model to use
	Context    RequestContext         `json:"context"`
	Options    map[string]interface{} `json:"options,omitempty"`
}

// TranslationResponse contains the result of a translation
type TranslationResponse struct {
	ProviderResponse
	TranslatedText string  `json:"translated_text"`
	SourceLang     string  `json:"source_lang"`
	TargetLang     string  `json:"target_lang"`
	Model          string  `json:"model,omitempty"`
	Confidence     float64 `json:"confidence,omitempty"` // 0.0 - 1.0 (if available)
}

// TranslationService is the interface that all translation providers must implement
type TranslationService interface {
	BaseProvider
	
	// Translate translates text from source language to target language
	Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error)
	
	// BatchTranslate translates multiple texts in a single request
	BatchTranslate(ctx context.Context, reqs []TranslationRequest) ([]*TranslationResponse, error)
	
	// GetSupportedLanguages returns supported language pairs
	GetSupportedLanguages() map[string][]string // source -> targets
	
	// GetCostPerRequest returns the estimated cost per request
	GetCostPerRequest(text string) float64
}

// TranslationProviderBase provides common functionality for translation providers
type TranslationProviderBase struct {
	providerType ProviderType
	name         string
	status       ProviderStatus
	metrics      ProviderMetrics
	config       ProviderConfig
}

// NewTranslationProviderBase creates a new translation provider base
func NewTranslationProviderBase(providerType ProviderType, name string, config ProviderConfig) *TranslationProviderBase {
	return &TranslationProviderBase{
		providerType: providerType,
		name:         name,
		status:       StatusUnknown,
		metrics:      ProviderMetrics{},
		config:       config,
	}
}

// GetType returns the provider type
func (p *TranslationProviderBase) GetType() ProviderType {
	return p.providerType
}

// GetServiceType returns the service type
func (p *TranslationProviderBase) GetServiceType() ServiceType {
	return ServiceTranslation
}

// GetName returns the provider name
func (p *TranslationProviderBase) GetName() string {
	return p.name
}

// GetStatus returns the current status
func (p *TranslationProviderBase) GetStatus() ProviderStatus {
	return p.status
}

// GetMetrics returns provider metrics
func (p *TranslationProviderBase) GetMetrics() ProviderMetrics {
	return p.metrics
}

// UpdateMetrics updates provider metrics
func (p *TranslationProviderBase) UpdateMetrics(latency time.Duration, success bool, err error) {
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
func (p *TranslationProviderBase) SetStatus(status ProviderStatus) {
	p.status = status
}

// Language code to full name mapping (for prompts)
var LanguageNames = map[string]string{
	"zh":  "Chinese",
	"en":  "English",
	"vi":  "Vietnamese",
	"id":  "Indonesian",
	"fil": "Filipino",
	"it":  "Italian",
	"ja":  "Japanese",
	"ko":  "Korean",
	"th":  "Thai",
	"es":  "Spanish",
	"fr":  "French",
	"de":  "German",
	"pt":  "Portuguese",
	"ru":  "Russian",
	"ar":  "Arabic",
	"hi":  "Hindi",
}

// GetLanguageName returns the full name of a language code
func GetLanguageName(code string) string {
	if name, ok := LanguageNames[code]; ok {
		return name
	}
	return code
}
