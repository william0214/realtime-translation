package asr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"realtime-translation-backend/internal/config"
)

type ASRProvider string

const (
	ASRProviderOpenAI ASRProvider = "openai"
	ASRProviderManus  ASRProvider = "manus"
)

type ASRService interface {
	TranscribeWebM(ctx context.Context, audio []byte) (text string, durationMs int, err error)
}

// OpenAIWhisperService implements ASR using OpenAI Whisper
type OpenAIWhisperService struct {
	apiKey  string
	baseURL string
}

func NewOpenAIWhisperService(cfg *config.Config) *OpenAIWhisperService {
	return &OpenAIWhisperService{
		apiKey:  cfg.OpenAI.APIKey,
		baseURL: cfg.OpenAI.BaseURL,
	}
}

func (s *OpenAIWhisperService) TranscribeWebM(ctx context.Context, audio []byte) (string, int, error) {
	start := time.Now()

	// Create multipart form data
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add audio file
	part, err := writer.CreateFormFile("file", "audio.webm")
	if err != nil {
		return "", 0, fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(audio)); err != nil {
		return "", 0, fmt.Errorf("failed to copy audio data: %w", err)
	}

	// Add model parameter
	if err := writer.WriteField("model", "whisper-1"); err != nil {
		return "", 0, fmt.Errorf("failed to write model field: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", 0, fmt.Errorf("failed to close writer: %w", err)
	}

	// Create request
	url := fmt.Sprintf("%s/audio/transcriptions", s.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.apiKey))
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", 0, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Parse response
	var result struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, fmt.Errorf("failed to decode response: %w", err)
	}

	durationMs := int(time.Since(start).Milliseconds())
	return result.Text, durationMs, nil
}

// ManusWhisperService implements ASR using Manus API
type ManusWhisperService struct {
	apiKey  string
	baseURL string
}

func NewManusWhisperService(cfg *config.Config) *ManusWhisperService {
	return &ManusWhisperService{
		apiKey:  cfg.Manus.APIKey,
		baseURL: cfg.Manus.BaseURL,
	}
}

func (s *ManusWhisperService) TranscribeWebM(ctx context.Context, audio []byte) (string, int, error) {
	start := time.Now()

	// Similar implementation to OpenAI, but using Manus API endpoint
	// TODO: Implement Manus-specific API call
	// For now, return placeholder
	
	durationMs := int(time.Since(start).Milliseconds())
	return "", durationMs, fmt.Errorf("Manus ASR not implemented yet")
}

// NewASRService creates an ASR service based on the provider
func NewASRService(provider ASRProvider, cfg *config.Config) ASRService {
	switch provider {
	case ASRProviderOpenAI:
		return NewOpenAIWhisperService(cfg)
	case ASRProviderManus:
		return NewManusWhisperService(cfg)
	default:
		return NewOpenAIWhisperService(cfg)
	}
}
