package tts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"realtime-translation-backend/internal/config"

	"github.com/google/uuid"
)

type TTSService struct {
	apiKey    string
	baseURL   string
	model     string
	outputDir string
}

func NewTTSService(cfg *config.Config) *TTSService {
	// Ensure output directory exists
	if err := os.MkdirAll(cfg.TTS.OutputDir, 0755); err != nil {
		// Log error but continue
		fmt.Printf("Warning: failed to create TTS output directory: %v\n", err)
	}

	return &TTSService{
		apiKey:    cfg.OpenAI.APIKey,
		baseURL:   cfg.OpenAI.BaseURL,
		model:     cfg.TTS.DefaultModel,
		outputDir: cfg.TTS.OutputDir,
	}
}

// GenerateSpeech generates speech audio from text
// Returns: audioFilePath, durationMs, error
func (s *TTSService) GenerateSpeech(ctx context.Context, text, lang string) (string, int, error) {
	start := time.Now()

	// Select voice based on language
	voice := s.selectVoice(lang)

	requestBody := map[string]interface{}{
		"model": s.model,
		"input": text,
		"voice": voice,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", 0, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/audio/speech", s.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.apiKey))
	req.Header.Set("Content-Type", "application/json")

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

	// Generate unique filename
	filename := fmt.Sprintf("%s.mp3", uuid.New().String())
	filepath := filepath.Join(s.outputDir, filename)

	// Save audio file
	file, err := os.Create(filepath)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create audio file: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", 0, fmt.Errorf("failed to write audio file: %w", err)
	}

	durationMs := int(time.Since(start).Milliseconds())
	return filepath, durationMs, nil
}

// selectVoice selects an appropriate voice based on language
func (s *TTSService) selectVoice(lang string) string {
	// OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
	// We can use different voices for different languages or contexts
	voiceMap := map[string]string{
		"zh": "nova",    // Chinese - female voice
		"en": "alloy",   // English - neutral voice
		"vi": "shimmer", // Vietnamese - female voice
		"ja": "nova",    // Japanese - female voice
		"ko": "shimmer", // Korean - female voice
		"th": "nova",    // Thai - female voice
		"id": "shimmer", // Indonesian - female voice
	}

	if voice, ok := voiceMap[lang]; ok {
		return voice
	}

	// Default voice
	return "alloy"
}

// GetAudioURL converts a file path to a public URL
// In production, this should upload to S3 and return the S3 URL
// For now, it returns a local file path
func (s *TTSService) GetAudioURL(filepath string) string {
	// TODO: Upload to S3 and return public URL
	// For now, return the local file path
	return filepath
}
