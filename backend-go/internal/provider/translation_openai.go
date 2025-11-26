package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OpenAITranslationProvider implements TranslationService using OpenAI GPT
type OpenAITranslationProvider struct {
	*TranslationProviderBase
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewOpenAITranslationProvider creates a new OpenAI translation provider
func NewOpenAITranslationProvider(config ProviderConfig) (TranslationService, error) {
	apiKey, ok := config.Credentials["api_key"]
	if !ok || apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key is required")
	}
	
	model := "gpt-4o-mini" // Default model
	if m, ok := config.Options["model"].(string); ok && m != "" {
		model = m
	}
	
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	
	base := NewTranslationProviderBase(ProviderOpenAITranslation, "OpenAI GPT", config)
	
	return &OpenAITranslationProvider{
		TranslationProviderBase: base,
		apiKey:                  apiKey,
		model:                   model,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Translate translates text using OpenAI GPT
func (p *OpenAITranslationProvider) Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error) {
	startTime := time.Now()
	
	model := req.Model
	if model == "" {
		model = p.model
	}
	
	// Build translation prompt
	prompt := p.buildTranslationPrompt(req.Text, req.SourceLang, req.TargetLang)
	
	// Call OpenAI API
	translatedText, err := p.callOpenAI(ctx, prompt, model)
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
		Model:          model,
	}, nil
}

// BatchTranslate translates multiple texts in a single request
func (p *OpenAITranslationProvider) BatchTranslate(ctx context.Context, reqs []TranslationRequest) ([]*TranslationResponse, error) {
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

// buildTranslationPrompt creates a translation prompt for OpenAI
func (p *OpenAITranslationProvider) buildTranslationPrompt(text, sourceLang, targetLang string) string {
	sourceName := GetLanguageName(sourceLang)
	targetName := GetLanguageName(targetLang)
	
	return fmt.Sprintf(
		"Translate the following %s text to %s. Only return the translated text without any explanation:\n\n%s",
		sourceName,
		targetName,
		text,
	)
}

// callOpenAI makes a request to OpenAI Chat Completions API
func (p *OpenAITranslationProvider) callOpenAI(ctx context.Context, prompt, model string) (string, error) {
	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": "You are a professional translator. Translate accurately and naturally.",
			},
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": 0.3,
		"max_tokens":  500,
	}
	
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(jsonData))
	if err != nil {
		return "", err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("OpenAI API returned status %d: %s", resp.StatusCode, string(body))
	}
	
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no translation returned from OpenAI")
	}
	
	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}

// GetSupportedLanguages returns supported language pairs
func (p *OpenAITranslationProvider) GetSupportedLanguages() map[string][]string {
	// OpenAI GPT supports all language pairs
	allLangs := []string{"en", "zh", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "vi", "id", "th", "fil", "ar", "hi"}
	
	result := make(map[string][]string)
	for _, lang := range allLangs {
		result[lang] = allLangs
	}
	
	return result
}

// GetCostPerRequest returns the estimated cost per request
func (p *OpenAITranslationProvider) GetCostPerRequest(text string) float64 {
	// Rough estimation: 1 token ≈ 4 characters
	tokens := len(text) / 4
	
	// GPT-4o-mini pricing (as of 2024)
	// Input: $0.15 / 1M tokens
	// Output: $0.60 / 1M tokens
	inputCost := float64(tokens) * 0.15 / 1000000
	outputCost := float64(tokens) * 0.60 / 1000000 // Assume output ≈ input length
	
	return inputCost + outputCost
}

// HealthCheck verifies the OpenAI API is accessible
func (p *OpenAITranslationProvider) HealthCheck(ctx context.Context) error {
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
