package provider

import (
	"context"
	"fmt"
	"time"

	texttospeech "cloud.google.com/go/texttospeech/apiv1"
	"cloud.google.com/go/texttospeech/apiv1/texttospeechpb"
)

// GoogleTTSProvider implements TTSService using Google Cloud Text-to-Speech API
type GoogleTTSProvider struct {
	client *texttospeech.Client
	config ProviderConfig
}

// NewGoogleTTSProvider creates a new Google Text-to-Speech provider
func NewGoogleTTSProvider(config ProviderConfig) (*GoogleTTSProvider, error) {
	// Note: Google Cloud client uses GOOGLE_APPLICATION_CREDENTIALS environment variable
	ctx := context.Background()
	client, err := texttospeech.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create Google TTS client: %w", err)
	}

	return &GoogleTTSProvider{
		client: client,
		config: config,
	}, nil
}

// Synthesize converts text to speech using Google TTS
func (p *GoogleTTSProvider) Synthesize(ctx context.Context, text, language, voice string) (*TTSResult, error) {
	startTime := time.Now()

	// Select voice if not provided
	if voice == "" {
		voice = getGoogleDefaultVoice(language)
	}

	// Prepare synthesis input
	input := &texttospeechpb.SynthesisInput{
		InputSource: &texttospeechpb.SynthesisInput_Text{
			Text: text,
		},
	}

	// Prepare voice parameters
	voiceParams := &texttospeechpb.VoiceSelectionParams{
		LanguageCode: convertToGoogleLanguageCode(language),
		Name:         voice,
	}

	// Prepare audio config
	audioConfig := &texttospeechpb.AudioConfig{
		AudioEncoding: texttospeechpb.AudioEncoding_MP3,
		SampleRateHertz: 16000,
	}

	// Perform synthesis
	resp, err := p.client.SynthesizeSpeech(ctx, &texttospeechpb.SynthesizeSpeechRequest{
		Input:       input,
		Voice:       voiceParams,
		AudioConfig: audioConfig,
	})
	if err != nil {
		return nil, fmt.Errorf("Google TTS synthesis failed: %w", err)
	}

	latency := time.Since(startTime).Milliseconds()

	return &TTSResult{
		AudioData:  resp.AudioContent,
		AudioURL:   "", // Will be set by storage service
		Format:     "mp3",
		SampleRate: 16000,
		LatencyMs:  int(latency),
	}, nil
}

// GetProviderInfo returns provider metadata
func (p *GoogleTTSProvider) GetProviderInfo() ProviderInfo {
	return ProviderInfo{
		Name:     "google",
		Type:     "tts",
		Model:    "neural2",
		Priority: p.config.Priority,
		Enabled:  p.config.Enabled,
	}
}

// Close releases resources
func (p *GoogleTTSProvider) Close() error {
	if p.client != nil {
		return p.client.Close()
	}
	return nil
}

// getGoogleDefaultVoice returns the default Google neural voice for a language
func getGoogleDefaultVoice(language string) string {
	// Google Cloud TTS voices: https://cloud.google.com/text-to-speech/docs/voices
	voices := map[string]string{
		"zh":    "zh-TW-Wavenet-A",    // Traditional Chinese (Female)
		"zh-CN": "zh-CN-Wavenet-A",    // Simplified Chinese (Female)
		"zh-TW": "zh-TW-Wavenet-A",    // Traditional Chinese (Female)
		"en":    "en-US-Neural2-F",    // English (Female)
		"en-US": "en-US-Neural2-F",    // English US (Female)
		"en-GB": "en-GB-Neural2-F",    // English UK (Female)
		"vi":    "vi-VN-Wavenet-A",    // Vietnamese (Female)
		"id":    "id-ID-Wavenet-A",    // Indonesian (Female)
		"th":    "th-TH-Neural2-C",    // Thai (Female)
		"ja":    "ja-JP-Neural2-B",    // Japanese (Female)
		"ko":    "ko-KR-Neural2-A",    // Korean (Female)
		"de":    "de-DE-Neural2-F",    // German (Female)
		"fr":    "fr-FR-Neural2-E",    // French (Female)
		"es":    "es-ES-Neural2-E",    // Spanish (Female)
		"it":    "it-IT-Neural2-A",    // Italian (Female)
		"pt":    "pt-PT-Wavenet-A",    // Portuguese (Female)
		"ru":    "ru-RU-Wavenet-A",    // Russian (Female)
	}

	if voice, ok := voices[language]; ok {
		return voice
	}
	return "en-US-Neural2-F" // Fallback
}
