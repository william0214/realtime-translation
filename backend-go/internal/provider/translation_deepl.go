package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// DeepLTranslationProvider implements TranslationService using DeepL API
type DeepLTranslationProvider struct {
	apiKey   string
	endpoint string
	config   ProviderConfig
	client   *http.Client
}

// NewDeepLTranslationProvider creates a new DeepL translation provider
func NewDeepLTranslationProvider(config ProviderConfig) (*DeepLTranslationProvider, error) {
	apiKey := config.Credentials["api_key"]
	if apiKey == "" {
		return nil, fmt.Errorf("DeepL API key is required")
	}

	// DeepL has two endpoints: free and pro
	endpoint := "https://api-free.deepl.com/v2/translate"
	if tier, ok := config.Credentials["tier"]; ok && tier == "pro" {
		endpoint = "https://api.deepl.com/v2/translate"
	}

	return &DeepLTranslationProvider{
		apiKey:   apiKey,
		endpoint: endpoint,
		config:   config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// deeplTranslateResponse represents the response from DeepL API
type deeplTranslateResponse struct {
	Translations []struct {
		DetectedSourceLanguage string `json:"detected_source_language"`
		Text                   string `json:"text"`
	} `json:"translations"`
}

// Translate translates text using DeepL API
func (p *DeepLTranslationProvider) Translate(ctx context.Context, text, sourceLang, targetLang string) (*TranslationResult, error) {
	startTime := time.Now()

	// Prepare form data
	data := url.Values{}
	data.Set("auth_key", p.apiKey)
	data.Set("text", text)
	data.Set("target_lang", convertToDeepLLanguageCode(targetLang))
	
	if sourceLang != "" {
		data.Set("source_lang", convertToDeepLLanguageCode(sourceLang))
	}

	// Optional: Set formality (formal/informal) for supported languages
	if formality, ok := p.config.Credentials["formality"]; ok {
		data.Set("formality", formality)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Send request
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("DeepL request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DeepL API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var translationResp deeplTranslateResponse
	if err := json.Unmarshal(respBody, &translationResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	latency := time.Since(startTime).Milliseconds()

	// Extract translation
	if len(translationResp.Translations) == 0 {
		return nil, fmt.Errorf("no translation returned")
	}

	translation := translationResp.Translations[0]
	detectedLang := translation.DetectedSourceLanguage
	if detectedLang != "" {
		sourceLang = detectedLang
	}

	return &TranslationResult{
		TranslatedText: translation.Text,
		SourceLanguage: sourceLang,
		TargetLanguage: targetLang,
		Confidence:     0.98, // DeepL doesn't provide confidence, use high default
		LatencyMs:      int(latency),
	}, nil
}

// GetProviderInfo returns provider metadata
func (p *DeepLTranslationProvider) GetProviderInfo() ProviderInfo {
	return ProviderInfo{
		Name:     "deepl",
		Type:     "translation",
		Model:    "deepl-v2",
		Priority: p.config.Priority,
		Enabled:  p.config.Enabled,
	}
}

// convertToDeepLLanguageCode converts our language codes to DeepL's format
func convertToDeepLLanguageCode(lang string) string {
	// DeepL uses uppercase ISO 639-1 codes with some extensions
	mapping := map[string]string{
		"zh":    "ZH",    // Chinese (simplified)
		"zh-CN": "ZH",    // Chinese (simplified)
		"zh-TW": "ZH",    // DeepL doesn't distinguish traditional/simplified
		"en":    "EN-US", // English (American)
		"en-GB": "EN-GB", // English (British)
		"vi":    "VI",    // Vietnamese (not supported by DeepL as of 2024)
		"id":    "ID",    // Indonesian
		"th":    "TH",    // Thai (not supported by DeepL as of 2024)
		"ja":    "JA",    // Japanese
		"ko":    "KO",    // Korean
		"de":    "DE",    // German
		"fr":    "FR",    // French
		"es":    "ES",    // Spanish
		"it":    "IT",    // Italian
		"pt":    "PT-PT", // Portuguese
		"ru":    "RU",    // Russian
	}

	if code, ok := mapping[lang]; ok {
		return code
	}
	return lang
}

// Note: DeepL does not support all languages. As of 2024, it supports:
// - European languages: DE, EN, ES, FR, IT, NL, PL, PT, RU, etc.
// - Asian languages: JA, KO, ZH
// - NOT supported: Vietnamese (VI), Thai (TH), Indonesian (ID)
//
// For unsupported languages, the API will return an error.
// Use ProviderManager's failover mechanism to switch to Google/Azure for these languages.
