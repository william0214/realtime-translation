package provider

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AzureTTSProvider implements TTSService using Azure Cognitive Services Text-to-Speech
type AzureTTSProvider struct {
	apiKey   string
	region   string
	endpoint string
	config   ProviderConfig
	client   *http.Client
}

// NewAzureTTSProvider creates a new Azure TTS provider
func NewAzureTTSProvider(config ProviderConfig) (*AzureTTSProvider, error) {
	apiKey := config.Credentials["api_key"]
	region := config.Credentials["region"]
	
	if apiKey == "" {
		return nil, fmt.Errorf("Azure TTS API key is required")
	}
	if region == "" {
		region = "eastus" // Default region
	}

	endpoint := fmt.Sprintf("https://%s.tts.speech.microsoft.com/cognitiveservices/v1", region)

	return &AzureTTSProvider{
		apiKey:   apiKey,
		region:   region,
		endpoint: endpoint,
		config:   config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// Synthesize converts text to speech using Azure TTS
func (p *AzureTTSProvider) Synthesize(ctx context.Context, text, language, voice string) (*TTSResult, error) {
	startTime := time.Now()

	// Select voice if not provided
	if voice == "" {
		voice = getAzureDefaultVoice(language)
	}

	// Build SSML (Speech Synthesis Markup Language)
	ssml := fmt.Sprintf(`
		<speak version='1.0' xml:lang='%s'>
			<voice name='%s'>
				%s
			</voice>
		</speak>
	`, language, voice, text)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewBufferString(ssml))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Ocp-Apim-Subscription-Key", p.apiKey)
	req.Header.Set("Content-Type", "application/ssml+xml")
	req.Header.Set("X-Microsoft-OutputFormat", "audio-16khz-32kbitrate-mono-mp3")

	// Send request
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Azure TTS request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	audioData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Azure TTS API error (status %d): %s", resp.StatusCode, string(audioData))
	}

	latency := time.Since(startTime).Milliseconds()

	return &TTSResult{
		AudioData:  audioData,
		AudioURL:   "", // Will be set by storage service
		Format:     "mp3",
		SampleRate: 16000,
		LatencyMs:  int(latency),
	}, nil
}

// GetProviderInfo returns provider metadata
func (p *AzureTTSProvider) GetProviderInfo() ProviderInfo {
	return ProviderInfo{
		Name:     "azure",
		Type:     "tts",
		Model:    "neural-tts",
		Priority: p.config.Priority,
		Enabled:  p.config.Enabled,
	}
}

// getAzureDefaultVoice returns the default Azure neural voice for a language
func getAzureDefaultVoice(language string) string {
	// Azure neural voices: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
	voices := map[string]string{
		"zh":    "zh-TW-HsiaoChenNeural",    // Traditional Chinese (Female)
		"zh-CN": "zh-CN-XiaoxiaoNeural",     // Simplified Chinese (Female)
		"zh-TW": "zh-TW-HsiaoChenNeural",    // Traditional Chinese (Female)
		"en":    "en-US-JennyNeural",        // English (Female)
		"en-US": "en-US-JennyNeural",        // English US (Female)
		"en-GB": "en-GB-SoniaNeural",        // English UK (Female)
		"vi":    "vi-VN-HoaiMyNeural",       // Vietnamese (Female)
		"id":    "id-ID-GadisNeural",        // Indonesian (Female)
		"th":    "th-TH-PremwadeeNeural",    // Thai (Female)
		"ja":    "ja-JP-NanamiNeural",       // Japanese (Female)
		"ko":    "ko-KR-SunHiNeural",        // Korean (Female)
		"de":    "de-DE-KatjaNeural",        // German (Female)
		"fr":    "fr-FR-DeniseNeural",       // French (Female)
		"es":    "es-ES-ElviraNeural",       // Spanish (Female)
		"it":    "it-IT-ElsaNeural",         // Italian (Female)
		"pt":    "pt-PT-RaquelNeural",       // Portuguese (Female)
		"ru":    "ru-RU-SvetlanaNeural",     // Russian (Female)
	}

	if voice, ok := voices[language]; ok {
		return voice
	}
	return "en-US-JennyNeural" // Fallback
}
