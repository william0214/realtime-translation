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

// AzureTranslationProvider implements TranslationService using Azure Cognitive Services Translator
type AzureTranslationProvider struct {
	apiKey   string
	region   string
	endpoint string
	config   ProviderConfig
	client   *http.Client
}

// NewAzureTranslationProvider creates a new Azure Translator provider
func NewAzureTranslationProvider(config ProviderConfig) (*AzureTranslationProvider, error) {
	apiKey := config.Credentials["api_key"]
	region := config.Credentials["region"]
	
	if apiKey == "" {
		return nil, fmt.Errorf("Azure Translator API key is required")
	}
	if region == "" {
		region = "global" // Default region
	}

	endpoint := "https://api.cognitive.microsofttranslator.com"
	if customEndpoint, ok := config.Credentials["endpoint"]; ok && customEndpoint != "" {
		endpoint = customEndpoint
	}

	return &AzureTranslationProvider{
		apiKey:   apiKey,
		region:   region,
		endpoint: endpoint,
		config:   config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// azureTranslateRequest represents the request body for Azure Translator API
type azureTranslateRequest struct {
	Text string `json:"text"`
}

// azureTranslateResponse represents the response from Azure Translator API
type azureTranslateResponse struct {
	Translations []struct {
		Text string `json:"text"`
		To   string `json:"to"`
	} `json:"translations"`
	DetectedLanguage *struct {
		Language string  `json:"language"`
		Score    float64 `json:"score"`
	} `json:"detectedLanguage,omitempty"`
}

// Translate translates text using Azure Cognitive Services Translator
func (p *AzureTranslationProvider) Translate(ctx context.Context, text, sourceLang, targetLang string) (*TranslationResult, error) {
	startTime := time.Now()

	// Prepare request body
	requestBody := []azureTranslateRequest{
		{Text: text},
	}
	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Build URL with query parameters
	url := fmt.Sprintf("%s/translate?api-version=3.0&to=%s", p.endpoint, convertToAzureLanguageCode(targetLang))
	if sourceLang != "" {
		url += fmt.Sprintf("&from=%s", convertToAzureLanguageCode(sourceLang))
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Ocp-Apim-Subscription-Key", p.apiKey)
	req.Header.Set("Ocp-Apim-Subscription-Region", p.region)
	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Azure Translator request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Azure Translator API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var translationResp []azureTranslateResponse
	if err := json.Unmarshal(respBody, &translationResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	latency := time.Since(startTime).Milliseconds()

	// Extract translation
	if len(translationResp) == 0 || len(translationResp[0].Translations) == 0 {
		return nil, fmt.Errorf("no translation returned")
	}

	translation := translationResp[0].Translations[0]
	confidence := 0.95 // Azure doesn't provide confidence scores, use default

	// If source language was detected, use that confidence
	if translationResp[0].DetectedLanguage != nil {
		confidence = translationResp[0].DetectedLanguage.Score
	}

	return &TranslationResult{
		TranslatedText: translation.Text,
		SourceLanguage: sourceLang,
		TargetLanguage: targetLang,
		Confidence:     confidence,
		LatencyMs:      int(latency),
	}, nil
}

// GetProviderInfo returns provider metadata
func (p *AzureTranslationProvider) GetProviderInfo() ProviderInfo {
	return ProviderInfo{
		Name:     "azure",
		Type:     "translation",
		Model:    "translator-v3",
		Priority: p.config.Priority,
		Enabled:  p.config.Enabled,
	}
}

// convertToAzureLanguageCode converts our language codes to Azure's format
func convertToAzureLanguageCode(lang string) string {
	// Azure uses ISO 639-1 codes with some extensions
	mapping := map[string]string{
		"zh":    "zh-Hant", // Traditional Chinese
		"zh-CN": "zh-Hans", // Simplified Chinese
		"zh-TW": "zh-Hant", // Traditional Chinese
		"en":    "en",
		"vi":    "vi",
		"id":    "id",
		"th":    "th",
		"ja":    "ja",
		"ko":    "ko",
	}

	if code, ok := mapping[lang]; ok {
		return code
	}
	return lang
}
