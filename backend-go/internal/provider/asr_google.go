package provider

import (
	"context"
	"fmt"
	"time"

	speech "cloud.google.com/go/speech/apiv1"
	"cloud.google.com/go/speech/apiv1/speechpb"
)

// GoogleASRProvider implements ASRService using Google Cloud Speech-to-Text API
type GoogleASRProvider struct {
	client *speech.Client
	config ProviderConfig
}

// NewGoogleASRProvider creates a new Google Speech-to-Text ASR provider
func NewGoogleASRProvider(config ProviderConfig) (*GoogleASRProvider, error) {
	// Note: Google Cloud client uses GOOGLE_APPLICATION_CREDENTIALS environment variable
	// Set this to the path of your service account JSON key file
	ctx := context.Background()
	client, err := speech.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create Google Speech client: %w", err)
	}

	return &GoogleASRProvider{
		client: client,
		config: config,
	}, nil
}

// Transcribe converts audio to text using Google Speech-to-Text
func (p *GoogleASRProvider) Transcribe(ctx context.Context, audioData []byte, language string) (*ASRResult, error) {
	startTime := time.Now()

	// Prepare recognition config
	config := &speechpb.RecognitionConfig{
		Encoding:        speechpb.RecognitionConfig_WEBM_OPUS, // Adjust based on your audio format
		SampleRateHertz: 48000,                                // Adjust based on your audio
		LanguageCode:    convertToGoogleLanguageCode(language),
		EnableAutomaticPunctuation: true,
		Model: "default", // or "medical_conversation" for medical use cases
	}

	// Prepare recognition audio
	audio := &speechpb.RecognitionAudio{
		AudioSource: &speechpb.RecognitionAudio_Content{
			Content: audioData,
		},
	}

	// Perform recognition
	resp, err := p.client.Recognize(ctx, &speechpb.RecognizeRequest{
		Config: config,
		Audio:  audio,
	})
	if err != nil {
		return nil, fmt.Errorf("Google Speech recognition failed: %w", err)
	}

	latency := time.Since(startTime).Milliseconds()

	// Extract best result
	if len(resp.Results) == 0 || len(resp.Results[0].Alternatives) == 0 {
		return &ASRResult{
			Text:       "",
			Language:   language,
			Confidence: 0.0,
			LatencyMs:  int(latency),
		}, nil
	}

	alternative := resp.Results[0].Alternatives[0]

	return &ASRResult{
		Text:       alternative.Transcript,
		Language:   language,
		Confidence: float64(alternative.Confidence),
		LatencyMs:  int(latency),
	}, nil
}

// TranscribeStream processes streaming audio (for future implementation)
func (p *GoogleASRProvider) TranscribeStream(ctx context.Context, audioStream <-chan []byte, language string) (<-chan *ASRResult, error) {
	// TODO: Implement streaming recognition using Google Speech-to-Text streaming API
	// This requires using client.StreamingRecognize() with bidirectional streaming
	return nil, fmt.Errorf("streaming not yet implemented for Google ASR")
}

// GetProviderInfo returns provider metadata
func (p *GoogleASRProvider) GetProviderInfo() ProviderInfo {
	return ProviderInfo{
		Name:     "google",
		Type:     "asr",
		Model:    "default",
		Priority: p.config.Priority,
		Enabled:  p.config.Enabled,
	}
}

// Close releases resources
func (p *GoogleASRProvider) Close() error {
	if p.client != nil {
		return p.client.Close()
	}
	return nil
}

// convertToGoogleLanguageCode converts our language codes to Google's format
func convertToGoogleLanguageCode(lang string) string {
	// Google uses BCP-47 language codes
	mapping := map[string]string{
		"zh":    "zh-TW", // Traditional Chinese
		"zh-CN": "zh-CN", // Simplified Chinese
		"zh-TW": "zh-TW", // Traditional Chinese
		"en":    "en-US",
		"vi":    "vi-VN",
		"id":    "id-ID",
		"th":    "th-TH",
		"ja":    "ja-JP",
		"ko":    "ko-KR",
	}

	if code, ok := mapping[lang]; ok {
		return code
	}
	return lang // Return as-is if not in mapping
}
