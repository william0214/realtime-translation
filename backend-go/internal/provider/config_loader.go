package provider

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// ConfigFile represents the structure of the client plans configuration file
type ConfigFile struct {
	ClientPlans []ClientPlan `json:"client_plans"`
}

// LoadClientPlans loads client plans from a JSON configuration file
func LoadClientPlans(filename string) ([]ClientPlan, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}
	
	// Expand environment variables
	expanded := expandEnvVars(string(data))
	
	var config ConfigFile
	if err := json.Unmarshal([]byte(expanded), &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}
	
	// Parse duration strings
	for i := range config.ClientPlans {
		plan := &config.ClientPlans[i]
		
		// Parse ASR provider timeouts
		for j := range plan.ASRConfig.Providers {
			if err := parseProviderTimeout(&plan.ASRConfig.Providers[j]); err != nil {
				return nil, err
			}
		}
		
		// Parse Translation provider timeouts
		for j := range plan.TransConfig.Providers {
			if err := parseProviderTimeout(&plan.TransConfig.Providers[j]); err != nil {
				return nil, err
			}
		}
		
		// Parse TTS provider timeouts
		for j := range plan.TTSConfig.Providers {
			if err := parseProviderTimeout(&plan.TTSConfig.Providers[j]); err != nil {
				return nil, err
			}
		}
	}
	
	return config.ClientPlans, nil
}

// expandEnvVars expands environment variables in the format ${VAR_NAME}
func expandEnvVars(s string) string {
	return os.Expand(s, func(key string) string {
		return os.Getenv(key)
	})
}

// parseProviderTimeout parses the timeout string and sets the Timeout field
func parseProviderTimeout(config *ProviderConfig) error {
	if timeoutStr, ok := config.Options["timeout"].(string); ok {
		duration, err := time.ParseDuration(timeoutStr)
		if err != nil {
			return fmt.Errorf("invalid timeout format for provider %s: %w", config.Type, err)
		}
		config.Timeout = duration
		delete(config.Options, "timeout")
	}
	
	return nil
}

// InitializeProviders initializes all providers from client plans
func InitializeProviders(manager *ProviderManager, plans []ClientPlan) error {
	// Track which providers have been initialized to avoid duplicates
	initializedASR := make(map[ProviderType]bool)
	initializedTranslation := make(map[ProviderType]bool)
	initializedTTS := make(map[ProviderType]bool)
	
	for _, plan := range plans {
		// Initialize ASR providers
		for _, providerConfig := range plan.ASRConfig.Providers {
			if !providerConfig.Enabled {
				continue
			}
			
			if initializedASR[providerConfig.Type] {
				continue
			}
			
			provider, err := createASRProvider(providerConfig)
			if err != nil {
				return fmt.Errorf("failed to create ASR provider %s: %w", providerConfig.Type, err)
			}
			
			manager.RegisterASRProvider(provider)
			initializedASR[providerConfig.Type] = true
		}
		
		// Initialize Translation providers
		for _, providerConfig := range plan.TransConfig.Providers {
			if !providerConfig.Enabled {
				continue
			}
			
			if initializedTranslation[providerConfig.Type] {
				continue
			}
			
			provider, err := createTranslationProvider(providerConfig)
			if err != nil {
				return fmt.Errorf("failed to create translation provider %s: %w", providerConfig.Type, err)
			}
			
			manager.RegisterTranslationProvider(provider)
			initializedTranslation[providerConfig.Type] = true
		}
		
		// Initialize TTS providers
		for _, providerConfig := range plan.TTSConfig.Providers {
			if !providerConfig.Enabled {
				continue
			}
			
			if initializedTTS[providerConfig.Type] {
				continue
			}
			
			provider, err := createTTSProvider(providerConfig)
			if err != nil {
				return fmt.Errorf("failed to create TTS provider %s: %w", providerConfig.Type, err)
			}
			
			manager.RegisterTTSProvider(provider)
			initializedTTS[providerConfig.Type] = true
		}
		
		// Register client plan
		manager.RegisterClientPlan(&plan)
	}
	
	return nil
}

// createASRProvider creates an ASR provider based on the config
func createASRProvider(config ProviderConfig) (ASRService, error) {
	switch config.Type {
	case ProviderOpenAIASR:
		return NewOpenAIASRProvider(config)
	case ProviderGoogleASR:
		// TODO: Implement Google ASR provider
		return nil, fmt.Errorf("Google ASR provider not yet implemented")
	case ProviderManusASR:
		// TODO: Implement Manus ASR provider
		return nil, fmt.Errorf("Manus ASR provider not yet implemented")
	default:
		return nil, fmt.Errorf("unknown ASR provider type: %s", config.Type)
	}
}

// createTranslationProvider creates a translation provider based on the config
func createTranslationProvider(config ProviderConfig) (TranslationService, error) {
	switch config.Type {
	case ProviderOpenAITranslation:
		return NewOpenAITranslationProvider(config)
	case ProviderGoogleTranslation:
		return NewGoogleTranslationProvider(config)
	case ProviderAzureTranslation:
		// TODO: Implement Azure translation provider
		return nil, fmt.Errorf("Azure translation provider not yet implemented")
	case ProviderDeepLTranslation:
		// TODO: Implement DeepL translation provider
		return nil, fmt.Errorf("DeepL translation provider not yet implemented")
	default:
		return nil, fmt.Errorf("unknown translation provider type: %s", config.Type)
	}
}

// createTTSProvider creates a TTS provider based on the config
func createTTSProvider(config ProviderConfig) (TTSService, error) {
	switch config.Type {
	case ProviderOpenAITTS:
		return NewOpenAITTSProvider(config)
	case ProviderAzureTTS:
		// TODO: Implement Azure TTS provider
		return nil, fmt.Errorf("Azure TTS provider not yet implemented")
	case ProviderGoogleTTS:
		// TODO: Implement Google TTS provider
		return nil, fmt.Errorf("Google TTS provider not yet implemented")
	default:
		return nil, fmt.Errorf("unknown TTS provider type: %s", config.Type)
	}
}

// ValidateClientPlan validates a client plan configuration
func ValidateClientPlan(plan *ClientPlan) error {
	if plan.ClientID == "" {
		return fmt.Errorf("client_id is required")
	}
	
	if plan.PlanName == "" {
		return fmt.Errorf("plan_name is required")
	}
	
	// Validate ASR config
	if len(plan.ASRConfig.Providers) == 0 {
		return fmt.Errorf("at least one ASR provider is required")
	}
	
	// Validate Translation config
	if len(plan.TransConfig.Providers) == 0 {
		return fmt.Errorf("at least one translation provider is required")
	}
	
	// Validate TTS config
	if len(plan.TTSConfig.Providers) == 0 {
		return fmt.Errorf("at least one TTS provider is required")
	}
	
	// Validate SLA
	if plan.SLA.MaxLatencyMs <= 0 {
		return fmt.Errorf("max_latency_ms must be positive")
	}
	
	if plan.SLA.MinAvailability < 0 || plan.SLA.MinAvailability > 1 {
		return fmt.Errorf("min_availability must be between 0 and 1")
	}
	
	if plan.SLA.MaxErrorRate < 0 || plan.SLA.MaxErrorRate > 1 {
		return fmt.Errorf("max_error_rate must be between 0 and 1")
	}
	
	return nil
}

// MarshalClientPlan marshals a client plan to JSON with pretty printing
func MarshalClientPlan(plan *ClientPlan) (string, error) {
	data, err := json.MarshalIndent(plan, "", "  ")
	if err != nil {
		return "", err
	}
	
	// Replace actual credentials with placeholders
	result := string(data)
	result = strings.ReplaceAll(result, os.Getenv("OPENAI_API_KEY"), "${OPENAI_API_KEY}")
	result = strings.ReplaceAll(result, os.Getenv("GOOGLE_API_KEY"), "${GOOGLE_API_KEY}")
	result = strings.ReplaceAll(result, os.Getenv("AZURE_API_KEY"), "${AZURE_API_KEY}")
	result = strings.ReplaceAll(result, os.Getenv("DEEPL_API_KEY"), "${DEEPL_API_KEY}")
	
	return result, nil
}
