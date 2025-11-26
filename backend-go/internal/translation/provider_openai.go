package translation

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OpenAIProvider implements TranslationService using OpenAI GPT models
type OpenAIProvider struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewOpenAIProvider creates a new OpenAI translation provider
func NewOpenAIProvider(apiKey string, model string) (*OpenAIProvider, error) {
	if apiKey == "" {
		return nil, ErrAPIKeyMissing
	}
	
	if model == "" {
		model = "gpt-4o-mini" // Default model
	}
	
	return &OpenAIProvider{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// Translate translates text using OpenAI GPT
func (p *OpenAIProvider) Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error) {
	model := req.Model
	if model == "" {
		model = p.model
	}
	
	// Build translation prompt
	prompt := p.buildTranslationPrompt(req.Text, req.SourceLang, req.TargetLang)
	
	// Call OpenAI API
	startTime := time.Now()
	translatedText, err := p.callOpenAI(ctx, prompt, model)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API error: %w", err)
	}
	latency := time.Since(startTime).Milliseconds()
	
	return &TranslationResponse{
		TranslatedText: translatedText,
		SourceLang:     req.SourceLang,
		TargetLang:     req.TargetLang,
		Provider:       string(ProviderOpenAI),
		Model:          model,
		LatencyMs:      latency,
	}, nil
}

// buildTranslationPrompt creates a translation prompt for OpenAI
func (p *OpenAIProvider) buildTranslationPrompt(text, sourceLang, targetLang string) string {
	// Language code to full name mapping
	langNames := map[string]string{
		"zh": "Chinese",
		"en": "English",
		"vi": "Vietnamese",
		"id": "Indonesian",
		"fil": "Filipino",
		"it": "Italian",
		"ja": "Japanese",
		"ko": "Korean",
		"th": "Thai",
	}
	
	sourceName := langNames[sourceLang]
	if sourceName == "" {
		sourceName = sourceLang
	}
	
	targetName := langNames[targetLang]
	if targetName == "" {
		targetName = targetLang
	}
	
	return fmt.Sprintf(
		"Translate the following %s text to %s. Only return the translated text without any explanation:\n\n%s",
		sourceName,
		targetName,
		text,
	)
}

// callOpenAI makes a request to OpenAI Chat Completions API
func (p *OpenAIProvider) callOpenAI(ctx context.Context, prompt, model string) (string, error) {
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
	
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", strings.NewReader(string(jsonData)))
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

// GetProvider returns the provider type
func (p *OpenAIProvider) GetProvider() TranslationProvider {
	return ProviderOpenAI
}

// HealthCheck verifies the OpenAI API is accessible
func (p *OpenAIProvider) HealthCheck(ctx context.Context) error {
	// Simple health check: try to translate a short text
	req := TranslationRequest{
		Text:       "Hello",
		SourceLang: "en",
		TargetLang: "zh",
	}
	
	_, err := p.Translate(ctx, req)
	return err
}
