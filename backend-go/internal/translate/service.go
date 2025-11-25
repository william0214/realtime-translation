package translate

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"realtime-translation-backend/internal/config"
)

type TranslateService struct {
	apiKey  string
	baseURL string
	model   string
}

func NewTranslateService(cfg *config.Config) *TranslateService {
	model := "gpt-4o-mini"
	if cfg.OpenAI.APIKey == "" {
		// Fallback to environment variable
		model = "gpt-4o-mini"
	}
	
	return &TranslateService{
		apiKey:  cfg.OpenAI.APIKey,
		baseURL: cfg.OpenAI.BaseURL,
		model:   model,
	}
}

// DetectLanguage detects the language of the given text
func (s *TranslateService) DetectLanguage(ctx context.Context, text string) (string, int, error) {
	start := time.Now()

	systemPrompt := "You are a language detection expert. Detect the language of the user's text and respond with ONLY the ISO 639-1 language code (e.g., 'zh', 'en', 'vi', 'ja'). No explanation, just the code."

	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
		{"role": "user", "content": text},
	}

	langCode, err := s.callOpenAI(ctx, messages)
	if err != nil {
		return "", 0, err
	}

	durationMs := int(time.Since(start).Milliseconds())
	return langCode, durationMs, nil
}

// Translate translates text from source language to target language
func (s *TranslateService) Translate(ctx context.Context, text, sourceLang, targetLang string) (string, int, error) {
	start := time.Now()

	// Map language codes to full names for better translation quality
	langNames := map[string]string{
		"zh": "Traditional Chinese (Taiwan)",
		"en": "English",
		"vi": "Vietnamese",
		"ja": "Japanese",
		"ko": "Korean",
		"th": "Thai",
		"id": "Indonesian",
	}

	sourceName := langNames[sourceLang]
	if sourceName == "" {
		sourceName = sourceLang
	}

	targetName := langNames[targetLang]
	if targetName == "" {
		targetName = targetLang
	}

	systemPrompt := fmt.Sprintf(
		"You are a professional medical translator. Translate the following text from %s to %s. "+
			"Provide ONLY the translation, no explanations or additional text. "+
			"Maintain medical terminology accuracy and natural fluency.",
		sourceName, targetName,
	)

	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
		{"role": "user", "content": text},
	}

	translation, err := s.callOpenAI(ctx, messages)
	if err != nil {
		return "", 0, err
	}

	durationMs := int(time.Since(start).Milliseconds())
	return translation, durationMs, nil
}

// callOpenAI makes a request to OpenAI Chat Completions API
func (s *TranslateService) callOpenAI(ctx context.Context, messages []map[string]string) (string, error) {
	requestBody := map[string]interface{}{
		"model":    s.model,
		"messages": messages,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/chat/completions", s.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.apiKey))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return result.Choices[0].Message.Content, nil
}
