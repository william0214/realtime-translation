package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GoogleTranslationProvider implements TranslationService using Google Cloud Translation v3
type GoogleTranslationProvider struct {
	*TranslationProviderBase
	apiKey     string
	projectID  string
	httpClient *http.Client
}

// NewGoogleTranslationProvider creates a new Google translation provider
func NewGoogleTranslationProvider(config ProviderConfig) (TranslationService, error) {
	apiKey, ok := config.Credentials["api_key"]
	if !ok || apiKey == "" {
		return nil, fmt.Errorf("Google API key is required")
	}
	
	projectID := "default"
	if pid, ok := config.Options["project_id"].(string); ok && pid != "" {
		projectID = pid
	}
	
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	
	base := NewTranslationProviderBase(ProviderGoogleTranslation, "Google Cloud Translation", config)
	
	return &GoogleTranslationProvider{
		TranslationProviderBase: base,
		apiKey:                  apiKey,
		projectID:               projectID,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Translate translates text using Google Cloud Translation
func (p *GoogleTranslationProvider) Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error) {
	startTime := time.Now()
	
	// Call Google Translation API
	translatedText, err := p.callGoogleAPI(ctx, req)
	latency := time.Since(startTime)
	
	// Update metrics
	p.UpdateMetrics(latency, err == nil, err)
	
	if err != nil {
		return &TranslationResponse{
			ProviderResponse: ProviderResponse{
				Provider:  p.GetType(),
				Success:   false,
				LatencyMs: latency.Milliseconds(),
				Error:     err.Error(),
				Timestamp: time.Now(),
			},
		}, err
	}
	
	return &TranslationResponse{
		ProviderResponse: ProviderResponse{
			Provider:  p.GetType(),
			Success:   true,
			LatencyMs: latency.Milliseconds(),
			Timestamp: time.Now(),
		},
		TranslatedText: translatedText,
		SourceLang:     req.SourceLang,
		TargetLang:     req.TargetLang,
	}, nil
}

// BatchTranslate translates multiple texts in a single request
func (p *GoogleTranslationProvider) BatchTranslate(ctx context.Context, reqs []TranslationRequest) ([]*TranslationResponse, error) {
	// Google Translation API supports batch translation
	// For simplicity, we'll iterate for now
	responses := make([]*TranslationResponse, len(reqs))
	
	for i, req := range reqs {
		resp, err := p.Translate(ctx, req)
		if err != nil {
			return nil, fmt.Errorf("batch translation failed at index %d: %w", i, err)
		}
		responses[i] = resp
	}
	
	return responses, nil
}

// callGoogleAPI makes a request to Google Cloud Translation API
func (p *GoogleTranslationProvider) callGoogleAPI(ctx context.Context, req TranslationRequest) (string, error) {
	// Google Cloud Translation API v3 (Basic)
	// https://translation.googleapis.com/language/translate/v2
	
	reqBody := map[string]interface{}{
		"q":      req.Text,
		"target": req.TargetLang,
		"format": "text",
	}
	
	if req.SourceLang != "" {
		reqBody["source"] = req.SourceLang
	}
	
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}
	
	url := fmt.Sprintf("https://translation.googleapis.com/language/translate/v2?key=%s", p.apiKey)
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return "", err
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	
	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Google API returned status %d: %s", resp.StatusCode, string(body))
	}
	
	var result struct {
		Data struct {
			Translations []struct {
				TranslatedText string `json:"translatedText"`
			} `json:"translations"`
		} `json:"data"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	
	if len(result.Data.Translations) == 0 {
		return "", fmt.Errorf("no translation returned from Google")
	}
	
	return result.Data.Translations[0].TranslatedText, nil
}

// GetSupportedLanguages returns supported language pairs
func (p *GoogleTranslationProvider) GetSupportedLanguages() map[string][]string {
	// Google Translation supports 100+ languages
	allLangs := []string{"en", "zh", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "vi", "id", "th", "fil", "ar", "hi"}
	
	result := make(map[string][]string)
	for _, lang := range allLangs {
		result[lang] = allLangs
	}
	
	return result
}

// GetCostPerRequest returns the estimated cost per request
func (p *GoogleTranslationProvider) GetCostPerRequest(text string) float64 {
	// Google Cloud Translation pricing (as of 2024)
	// $20 per 1M characters
	chars := len(text)
	return float64(chars) * 20.0 / 1000000
}

// HealthCheck verifies the Google API is accessible
func (p *GoogleTranslationProvider) HealthCheck(ctx context.Context) error {
	// Simple health check: try to translate a short text
	req := TranslationRequest{
		Text:       "Hello",
		SourceLang: "en",
		TargetLang: "zh",
		Context:    RequestContext{},
	}
	
	_, err := p.Translate(ctx, req)
	if err != nil {
		p.SetStatus(StatusUnhealthy)
		return err
	}
	
	p.SetStatus(StatusHealthy)
	return nil
}
