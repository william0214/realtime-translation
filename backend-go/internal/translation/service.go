package translation

import (
	"context"
	"time"
)

// TranslationProvider represents the type of translation service
type TranslationProvider string

const (
	ProviderOpenAI TranslationProvider = "openai"
	ProviderGoogle TranslationProvider = "google"
	ProviderAzure  TranslationProvider = "azure"
	ProviderDeepL  TranslationProvider = "deepl"
)

// TranslationRequest contains the parameters for a translation request
type TranslationRequest struct {
	Text       string `json:"text"`
	SourceLang string `json:"source_lang"` // ISO 639-1 code (e.g., "zh", "en", "vi")
	TargetLang string `json:"target_lang"` // ISO 639-1 code
	Model      string `json:"model,omitempty"` // Optional: specific model to use
}

// TranslationResponse contains the result of a translation
type TranslationResponse struct {
	TranslatedText string `json:"translated_text"`
	SourceLang     string `json:"source_lang"`
	TargetLang     string `json:"target_lang"`
	Provider       string `json:"provider"`
	Model          string `json:"model,omitempty"`
	LatencyMs      int64  `json:"latency_ms"`
}

// TranslationService is the interface that all translation providers must implement
type TranslationService interface {
	// Translate translates text from source language to target language
	Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error)
	
	// GetProvider returns the provider type
	GetProvider() TranslationProvider
	
	// HealthCheck verifies the provider is accessible
	HealthCheck(ctx context.Context) error
}

// TranslationConfig holds configuration for translation services
type TranslationConfig struct {
	// Default provider to use
	DefaultProvider TranslationProvider `json:"default_provider"`
	
	// Default model for each provider
	DefaultModels map[TranslationProvider]string `json:"default_models"`
	
	// Language-specific provider overrides
	// e.g., {"vi": "google", "id": "google"} to use Google for Vietnamese and Indonesian
	LanguageProviders map[string]TranslationProvider `json:"language_providers"`
	
	// Provider credentials
	OpenAIAPIKey  string `json:"openai_api_key,omitempty"`
	GoogleAPIKey  string `json:"google_api_key,omitempty"`
	AzureAPIKey   string `json:"azure_api_key,omitempty"`
	AzureEndpoint string `json:"azure_endpoint,omitempty"`
	DeepLAPIKey   string `json:"deepl_api_key,omitempty"`
}

// TranslationManager manages multiple translation providers
type TranslationManager struct {
	config    TranslationConfig
	providers map[TranslationProvider]TranslationService
}

// NewTranslationManager creates a new translation manager with the given config
func NewTranslationManager(config TranslationConfig) (*TranslationManager, error) {
	manager := &TranslationManager{
		config:    config,
		providers: make(map[TranslationProvider]TranslationService),
	}
	
	// Initialize providers based on available credentials
	if config.OpenAIAPIKey != "" {
		provider, err := NewOpenAIProvider(config.OpenAIAPIKey, config.DefaultModels[ProviderOpenAI])
		if err != nil {
			return nil, err
		}
		manager.providers[ProviderOpenAI] = provider
	}
	
	if config.GoogleAPIKey != "" {
		provider, err := NewGoogleProvider(config.GoogleAPIKey)
		if err != nil {
			return nil, err
		}
		manager.providers[ProviderGoogle] = provider
	}
	
	if config.AzureAPIKey != "" && config.AzureEndpoint != "" {
		provider, err := NewAzureProvider(config.AzureAPIKey, config.AzureEndpoint)
		if err != nil {
			return nil, err
		}
		manager.providers[ProviderAzure] = provider
	}
	
	if config.DeepLAPIKey != "" {
		provider, err := NewDeepLProvider(config.DeepLAPIKey)
		if err != nil {
			return nil, err
		}
		manager.providers[ProviderDeepL] = provider
	}
	
	return manager, nil
}

// Translate automatically selects the best provider and translates the text
func (m *TranslationManager) Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error) {
	provider := m.selectProvider(req.TargetLang)
	
	service, ok := m.providers[provider]
	if !ok {
		// Fallback to default provider
		service, ok = m.providers[m.config.DefaultProvider]
		if !ok {
			return nil, ErrNoProviderAvailable
		}
	}
	
	startTime := time.Now()
	resp, err := service.Translate(ctx, req)
	if err != nil {
		return nil, err
	}
	
	resp.LatencyMs = time.Since(startTime).Milliseconds()
	return resp, nil
}

// selectProvider chooses the best provider based on target language and config
func (m *TranslationManager) selectProvider(targetLang string) TranslationProvider {
	// Check language-specific override
	if provider, ok := m.config.LanguageProviders[targetLang]; ok {
		return provider
	}
	
	// Use default provider
	return m.config.DefaultProvider
}

// GetProvider returns a specific translation provider
func (m *TranslationManager) GetProvider(provider TranslationProvider) (TranslationService, bool) {
	service, ok := m.providers[provider]
	return service, ok
}

// HealthCheck checks all available providers
func (m *TranslationManager) HealthCheck(ctx context.Context) map[TranslationProvider]error {
	results := make(map[TranslationProvider]error)
	
	for providerType, service := range m.providers {
		results[providerType] = service.HealthCheck(ctx)
	}
	
	return results
}
