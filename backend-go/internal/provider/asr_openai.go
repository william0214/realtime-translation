package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// OpenAIASRProvider implements ASRService using OpenAI Whisper
type OpenAIASRProvider struct {
	*ASRProviderBase
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewOpenAIASRProvider creates a new OpenAI Whisper ASR provider
func NewOpenAIASRProvider(config ProviderConfig) (ASRService, error) {
	apiKey, ok := config.Credentials["api_key"]
	if !ok || apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key is required")
	}
	
	model := "whisper-1" // Default model
	if m, ok := config.Options["model"].(string); ok && m != "" {
		model = m
	}
	
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	
	base := NewASRProviderBase(ProviderOpenAIASR, "OpenAI Whisper", config)
	
	return &OpenAIASRProvider{
		ASRProviderBase: base,
		apiKey:          apiKey,
		model:           model,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Transcribe transcribes audio to text using OpenAI Whisper
func (p *OpenAIASRProvider) Transcribe(ctx context.Context, req ASRRequest) (*ASRResponse, error) {
	startTime := time.Now()
	
	// Call OpenAI Whisper API
	transcript, detectedLang, err := p.callWhisperAPI(ctx, req)
	latency := time.Since(startTime)
	
	// Update metrics
	p.UpdateMetrics(latency, err == nil, err)
	
	if err != nil {
		return &ASRResponse{
			ProviderResponse: ProviderResponse{
				Provider:  p.GetType(),
				Success:   false,
				LatencyMs: latency.Milliseconds(),
				Error:     err.Error(),
				Timestamp: time.Now(),
			},
		}, err
	}
	
	return &ASRResponse{
		ProviderResponse: ProviderResponse{
			Provider:  p.GetType(),
			Success:   true,
			LatencyMs: latency.Milliseconds(),
			Timestamp: time.Now(),
		},
		Transcript:       transcript,
		DetectedLanguage: detectedLang,
		Confidence:       1.0, // OpenAI doesn't provide confidence scores
		IsPartial:        false,
		IsFinal:          true,
	}, nil
}

// TranscribeStream is not supported by OpenAI Whisper (no streaming API)
func (p *OpenAIASRProvider) TranscribeStream(ctx context.Context, req ASRRequest, callback ASRStreamCallback) error {
	return fmt.Errorf("streaming mode is not supported by OpenAI Whisper")
}

// TranscribeHybrid implements pseudo-streaming by returning immediate result
func (p *OpenAIASRProvider) TranscribeHybrid(ctx context.Context, req ASRRequest, callback ASRStreamCallback) (*ASRResponse, error) {
	// For OpenAI Whisper, hybrid mode is the same as segment mode
	// We return the result immediately as both partial and final
	resp, err := p.Transcribe(ctx, req)
	if err != nil {
		return nil, err
	}
	
	// Call callback with the result as "partial" (for immediate display)
	if callback != nil {
		partialResp := *resp
		partialResp.IsPartial = true
		partialResp.IsFinal = false
		if err := callback(&partialResp); err != nil {
			return nil, err
		}
	}
	
	// Return the same result as final
	return resp, nil
}

// callWhisperAPI calls the OpenAI Whisper API
func (p *OpenAIASRProvider) callWhisperAPI(ctx context.Context, req ASRRequest) (string, string, error) {
	// Create multipart form data
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	
	// Add audio file
	part, err := writer.CreateFormFile("file", "audio.webm")
	if err != nil {
		return "", "", err
	}
	if _, err := part.Write(req.AudioData); err != nil {
		return "", "", err
	}
	
	// Add model
	if err := writer.WriteField("model", p.model); err != nil {
		return "", "", err
	}
	
	// Add language hint if provided
	if req.Language != "" {
		if err := writer.WriteField("language", req.Language); err != nil {
			return "", "", err
		}
	}
	
	// Add response format
	if err := writer.WriteField("response_format", "verbose_json"); err != nil {
		return "", "", err
	}
	
	if err := writer.Close(); err != nil {
		return "", "", err
	}
	
	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/audio/transcriptions", &buf)
	if err != nil {
		return "", "", err
	}
	
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	
	// Send request
	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("OpenAI API returned status %d: %s", resp.StatusCode, string(body))
	}
	
	// Parse response
	var result struct {
		Text     string `json:"text"`
		Language string `json:"language"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}
	
	return result.Text, result.Language, nil
}

// GetSupportedFormats returns supported audio formats
func (p *OpenAIASRProvider) GetSupportedFormats() []string {
	return []string{"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}
}

// GetSupportedLanguages returns supported languages
func (p *OpenAIASRProvider) GetSupportedLanguages() []string {
	// OpenAI Whisper supports 99 languages
	return []string{
		"en", "zh", "es", "fr", "de", "it", "pt", "ru", "ja", "ko",
		"vi", "id", "th", "fil", "ar", "hi", "tr", "pl", "nl", "sv",
		// ... (add more as needed)
	}
}

// HealthCheck verifies the OpenAI API is accessible
func (p *OpenAIASRProvider) HealthCheck(ctx context.Context) error {
	// Simple health check: verify API key is valid
	// We don't actually transcribe audio to avoid costs
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.openai.com/v1/models", nil)
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	
	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.SetStatus(StatusUnhealthy)
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusOK {
		p.SetStatus(StatusHealthy)
		return nil
	}
	
	p.SetStatus(StatusUnhealthy)
	return fmt.Errorf("health check failed with status %d", resp.StatusCode)
}
