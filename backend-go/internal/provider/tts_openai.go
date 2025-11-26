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

// OpenAITTSProvider implements TTSService using OpenAI TTS
type OpenAITTSProvider struct {
	*TTSProviderBase
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewOpenAITTSProvider creates a new OpenAI TTS provider
func NewOpenAITTSProvider(config ProviderConfig) (TTSService, error) {
	apiKey, ok := config.Credentials["api_key"]
	if !ok || apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key is required")
	}
	
	model := "tts-1" // Default model (faster, cheaper)
	if m, ok := config.Options["model"].(string); ok && m != "" {
		model = m // can be "tts-1" or "tts-1-hd"
	}
	
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 60 * time.Second // TTS can take longer
	}
	
	base := NewTTSProviderBase(ProviderOpenAITTS, "OpenAI TTS", config)
	
	return &OpenAITTSProvider{
		TTSProviderBase: base,
		apiKey:          apiKey,
		model:           model,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Synthesize converts text to speech using OpenAI TTS
func (p *OpenAITTSProvider) Synthesize(ctx context.Context, req TTSRequest) (*TTSResponse, error) {
	startTime := time.Now()
	
	voice := req.Voice
	if voice == "" {
		voice = "alloy" // Default voice
	}
	
	speed := req.Speed
	if speed == 0 {
		speed = 1.0
	}
	
	// Call OpenAI TTS API
	audioData, err := p.callTTSAPI(ctx, req.Text, voice, speed)
	latency := time.Since(startTime)
	
	// Update metrics
	p.UpdateMetrics(latency, err == nil, err)
	
	if err != nil {
		return &TTSResponse{
			ProviderResponse: ProviderResponse{
				Provider:  p.GetType(),
				Success:   false,
				LatencyMs: latency.Milliseconds(),
				Error:     err.Error(),
				Timestamp: time.Now(),
			},
		}, err
	}
	
	format := req.Format
	if format == "" {
		format = "mp3"
	}
	
	// Estimate duration (rough: 150 words per minute, 5 chars per word)
	words := float64(len(req.Text)) / 5.0
	duration := (words / 150.0) * 60.0
	
	return &TTSResponse{
		ProviderResponse: ProviderResponse{
			Provider:  p.GetType(),
			Success:   true,
			LatencyMs: latency.Milliseconds(),
			Timestamp: time.Now(),
		},
		AudioData: audioData,
		Format:    format,
		Duration:  duration,
		Voice:     voice,
	}, nil
}

// callTTSAPI makes a request to OpenAI TTS API
func (p *OpenAITTSProvider) callTTSAPI(ctx context.Context, text, voice string, speed float64) ([]byte, error) {
	reqBody := map[string]interface{}{
		"model": p.model,
		"input": text,
		"voice": voice,
		"speed": speed,
	}
	
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/audio/speech", bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API returned status %d: %s", resp.StatusCode, string(body))
	}
	
	// Read audio data
	audioData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	return audioData, nil
}

// GetVoices returns available voices
func (p *OpenAITTSProvider) GetVoices(language string) ([]VoiceInfo, error) {
	// OpenAI TTS voices (as of 2024)
	voices := []VoiceInfo{
		{ID: "alloy", Name: "Alloy", Language: "multi", Gender: "neutral"},
		{ID: "echo", Name: "Echo", Language: "multi", Gender: "male"},
		{ID: "fable", Name: "Fable", Language: "multi", Gender: "neutral"},
		{ID: "onyx", Name: "Onyx", Language: "multi", Gender: "male"},
		{ID: "nova", Name: "Nova", Language: "multi", Gender: "female"},
		{ID: "shimmer", Name: "Shimmer", Language: "multi", Gender: "female"},
	}
	
	return voices, nil
}

// GetSupportedLanguages returns supported languages
func (p *OpenAITTSProvider) GetSupportedLanguages() []string {
	// OpenAI TTS supports multiple languages
	return []string{
		"en", "zh", "es", "fr", "de", "it", "pt", "ru", "ja", "ko",
		"vi", "id", "th", "ar", "hi", "tr", "pl", "nl", "sv",
	}
}

// GetSupportedFormats returns supported audio formats
func (p *OpenAITTSProvider) GetSupportedFormats() []string {
	return []string{"mp3", "opus", "aac", "flac"}
}

// GetCostPerRequest returns the estimated cost per request
func (p *OpenAITTSProvider) GetCostPerRequest(text string) float64 {
	// OpenAI TTS pricing (as of 2024)
	// tts-1: $15 per 1M characters
	// tts-1-hd: $30 per 1M characters
	chars := len(text)
	
	costPerMillion := 15.0
	if p.model == "tts-1-hd" {
		costPerMillion = 30.0
	}
	
	return float64(chars) * costPerMillion / 1000000
}

// HealthCheck verifies the OpenAI API is accessible
func (p *OpenAITTSProvider) HealthCheck(ctx context.Context) error {
	// Simple health check: verify API key is valid
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.openai.com/v1/models", nil)
	if err != nil {
		p.SetStatus(StatusUnhealthy)
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
