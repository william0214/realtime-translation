package provider

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// ProviderManager manages multiple providers with intelligent routing and failover
type ProviderManager struct {
	asrProviders         map[ProviderType]ASRService
	translationProviders map[ProviderType]TranslationService
	ttsProviders         map[ProviderType]TTSService
	
	clientPlans map[string]*ClientPlan
	
	mu sync.RWMutex
	
	// Round-robin counters
	asrRRCounter         int
	translationRRCounter int
	ttsRRCounter         int
}

// NewProviderManager creates a new provider manager
func NewProviderManager() *ProviderManager {
	return &ProviderManager{
		asrProviders:         make(map[ProviderType]ASRService),
		translationProviders: make(map[ProviderType]TranslationService),
		ttsProviders:         make(map[ProviderType]TTSService),
		clientPlans:          make(map[string]*ClientPlan),
	}
}

// RegisterASRProvider registers an ASR provider
func (m *ProviderManager) RegisterASRProvider(provider ASRService) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.asrProviders[provider.GetType()] = provider
}

// RegisterTranslationProvider registers a translation provider
func (m *ProviderManager) RegisterTranslationProvider(provider TranslationService) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.translationProviders[provider.GetType()] = provider
}

// RegisterTTSProvider registers a TTS provider
func (m *ProviderManager) RegisterTTSProvider(provider TTSService) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.ttsProviders[provider.GetType()] = provider
}

// RegisterClientPlan registers a client plan
func (m *ProviderManager) RegisterClientPlan(plan *ClientPlan) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.clientPlans[plan.ClientID] = plan
}

// GetClientPlan retrieves a client plan
func (m *ProviderManager) GetClientPlan(clientID string) (*ClientPlan, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	plan, ok := m.clientPlans[clientID]
	return plan, ok
}

// Transcribe performs ASR with intelligent routing and failover
func (m *ProviderManager) Transcribe(ctx context.Context, req ASRRequest) (*ASRResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	// Get client plan
	plan, ok := m.clientPlans[req.Context.ClientID]
	if !ok {
		return nil, fmt.Errorf("client plan not found for client %s", req.Context.ClientID)
	}
	
	// Select providers based on routing strategy
	providers := m.selectASRProviders(plan.ASRConfig, req.Language)
	
	// Try providers with failover
	var lastErr error
	for _, providerType := range providers {
		provider, ok := m.asrProviders[providerType]
		if !ok || provider.GetStatus() == StatusUnhealthy {
			continue
		}
		
		var resp *ASRResponse
		var err error
		
		switch req.Mode {
		case ASRModeSegment:
			resp, err = provider.Transcribe(ctx, req)
		case ASRModeStream:
			// Streaming mode requires callback
			return nil, fmt.Errorf("streaming mode requires callback, use TranscribeStream instead")
		case ASRModeHybrid:
			// Hybrid mode requires callback
			return nil, fmt.Errorf("hybrid mode requires callback, use TranscribeHybrid instead")
		default:
			resp, err = provider.Transcribe(ctx, req)
		}
		
		if err == nil {
			return resp, nil
		}
		
		lastErr = err
		
		// If failover strategy is "none", return immediately
		if plan.ASRConfig.FailoverStrategy == FailoverNone {
			break
		}
		
		// If failover strategy is "next", try next provider
		if plan.ASRConfig.FailoverStrategy == FailoverNext {
			continue
		}
	}
	
	if lastErr != nil {
		return nil, fmt.Errorf("all ASR providers failed: %w", lastErr)
	}
	
	return nil, fmt.Errorf("no ASR provider available")
}

// Translate performs translation with intelligent routing and failover
func (m *ProviderManager) Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	// Get client plan
	plan, ok := m.clientPlans[req.Context.ClientID]
	if !ok {
		return nil, fmt.Errorf("client plan not found for client %s", req.Context.ClientID)
	}
	
	// Select providers based on routing strategy
	providers := m.selectTranslationProviders(plan.TransConfig, req.TargetLang)
	
	// Try providers with failover
	var lastErr error
	for _, providerType := range providers {
		provider, ok := m.translationProviders[providerType]
		if !ok || provider.GetStatus() == StatusUnhealthy {
			continue
		}
		
		resp, err := provider.Translate(ctx, req)
		if err == nil {
			return resp, nil
		}
		
		lastErr = err
		
		// If failover strategy is "none", return immediately
		if plan.TransConfig.FailoverStrategy == FailoverNone {
			break
		}
		
		// If failover strategy is "next", try next provider
		if plan.TransConfig.FailoverStrategy == FailoverNext {
			continue
		}
	}
	
	if lastErr != nil {
		return nil, fmt.Errorf("all translation providers failed: %w", lastErr)
	}
	
	return nil, fmt.Errorf("no translation provider available")
}

// Synthesize performs TTS with intelligent routing and failover
func (m *ProviderManager) Synthesize(ctx context.Context, req TTSRequest) (*TTSResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	// Get client plan
	plan, ok := m.clientPlans[req.Context.ClientID]
	if !ok {
		return nil, fmt.Errorf("client plan not found for client %s", req.Context.ClientID)
	}
	
	// Select providers based on routing strategy
	providers := m.selectTTSProviders(plan.TTSConfig, req.Language)
	
	// Try providers with failover
	var lastErr error
	for _, providerType := range providers {
		provider, ok := m.ttsProviders[providerType]
		if !ok || provider.GetStatus() == StatusUnhealthy {
			continue
		}
		
		resp, err := provider.Synthesize(ctx, req)
		if err == nil {
			return resp, nil
		}
		
		lastErr = err
		
		// If failover strategy is "none", return immediately
		if plan.TTSConfig.FailoverStrategy == FailoverNone {
			break
		}
		
		// If failover strategy is "next", try next provider
		if plan.TTSConfig.FailoverStrategy == FailoverNext {
			continue
		}
	}
	
	if lastErr != nil {
		return nil, fmt.Errorf("all TTS providers failed: %w", lastErr)
	}
	
	return nil, fmt.Errorf("no TTS provider available")
}

// selectASRProviders selects ASR providers based on routing strategy
func (m *ProviderManager) selectASRProviders(config ServiceConfig, language string) []ProviderType {
	// Check language-specific override
	if providerType, ok := config.LanguageProviders[language]; ok {
		return []ProviderType{providerType}
	}
	
	switch config.RoutingStrategy {
	case RoutingPriority:
		return m.selectByPriority(config.Providers)
	case RoutingLatency:
		return m.selectByLatency(ServiceASR)
	case RoutingRoundRobin:
		return m.selectRoundRobin(config.Providers, &m.asrRRCounter)
	default:
		return m.selectByPriority(config.Providers)
	}
}

// selectTranslationProviders selects translation providers based on routing strategy
func (m *ProviderManager) selectTranslationProviders(config ServiceConfig, language string) []ProviderType {
	// Check language-specific override
	if providerType, ok := config.LanguageProviders[language]; ok {
		return []ProviderType{providerType}
	}
	
	switch config.RoutingStrategy {
	case RoutingPriority:
		return m.selectByPriority(config.Providers)
	case RoutingLatency:
		return m.selectByLatency(ServiceTranslation)
	case RoutingCost:
		return m.selectByCost(config.Providers)
	case RoutingRoundRobin:
		return m.selectRoundRobin(config.Providers, &m.translationRRCounter)
	default:
		return m.selectByPriority(config.Providers)
	}
}

// selectTTSProviders selects TTS providers based on routing strategy
func (m *ProviderManager) selectTTSProviders(config ServiceConfig, language string) []ProviderType {
	// Check language-specific override
	if providerType, ok := config.LanguageProviders[language]; ok {
		return []ProviderType{providerType}
	}
	
	switch config.RoutingStrategy {
	case RoutingPriority:
		return m.selectByPriority(config.Providers)
	case RoutingLatency:
		return m.selectByLatency(ServiceTTS)
	case RoutingCost:
		return m.selectByCost(config.Providers)
	case RoutingRoundRobin:
		return m.selectRoundRobin(config.Providers, &m.ttsRRCounter)
	default:
		return m.selectByPriority(config.Providers)
	}
}

// selectByPriority selects providers by priority (highest first)
func (m *ProviderManager) selectByPriority(providers []ProviderConfig) []ProviderType {
	// Sort by priority (descending)
	sorted := make([]ProviderConfig, len(providers))
	copy(sorted, providers)
	
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].Priority > sorted[i].Priority {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	
	result := make([]ProviderType, 0, len(sorted))
	for _, p := range sorted {
		if p.Enabled {
			result = append(result, p.Type)
		}
	}
	
	return result
}

// selectByLatency selects providers by average latency (fastest first)
func (m *ProviderManager) selectByLatency(serviceType ServiceType) []ProviderType {
	type providerLatency struct {
		providerType ProviderType
		latency      time.Duration
	}
	
	var providers []providerLatency
	
	switch serviceType {
	case ServiceASR:
		for pt, p := range m.asrProviders {
			if p.GetStatus() != StatusUnhealthy {
				providers = append(providers, providerLatency{pt, p.GetMetrics().AverageLatency})
			}
		}
	case ServiceTranslation:
		for pt, p := range m.translationProviders {
			if p.GetStatus() != StatusUnhealthy {
				providers = append(providers, providerLatency{pt, p.GetMetrics().AverageLatency})
			}
		}
	case ServiceTTS:
		for pt, p := range m.ttsProviders {
			if p.GetStatus() != StatusUnhealthy {
				providers = append(providers, providerLatency{pt, p.GetMetrics().AverageLatency})
			}
		}
	}
	
	// Sort by latency (ascending)
	for i := 0; i < len(providers); i++ {
		for j := i + 1; j < len(providers); j++ {
			if providers[j].latency < providers[i].latency {
				providers[i], providers[j] = providers[j], providers[i]
			}
		}
	}
	
	result := make([]ProviderType, len(providers))
	for i, p := range providers {
		result[i] = p.providerType
	}
	
	return result
}

// selectByCost selects providers by cost (cheapest first)
func (m *ProviderManager) selectByCost(providers []ProviderConfig) []ProviderType {
	// For simplicity, we'll use priority as a proxy for cost
	// In a real implementation, you would calculate actual costs
	return m.selectByPriority(providers)
}

// selectRoundRobin selects providers in round-robin fashion
func (m *ProviderManager) selectRoundRobin(providers []ProviderConfig, counter *int) []ProviderType {
	enabled := make([]ProviderType, 0, len(providers))
	for _, p := range providers {
		if p.Enabled {
			enabled = append(enabled, p.Type)
		}
	}
	
	if len(enabled) == 0 {
		return nil
	}
	
	// Select next provider in round-robin
	*counter = (*counter + 1) % len(enabled)
	
	// Return selected provider first, then others as fallback
	result := make([]ProviderType, len(enabled))
	for i := 0; i < len(enabled); i++ {
		result[i] = enabled[(*counter+i)%len(enabled)]
	}
	
	return result
}

// HealthCheck checks all providers
func (m *ProviderManager) HealthCheck(ctx context.Context) map[ProviderType]ProviderStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	results := make(map[ProviderType]ProviderStatus)
	
	for pt, p := range m.asrProviders {
		results[pt] = p.GetStatus()
	}
	
	for pt, p := range m.translationProviders {
		results[pt] = p.GetStatus()
	}
	
	for pt, p := range m.ttsProviders {
		results[pt] = p.GetStatus()
	}
	
	return results
}

// GetMetrics returns metrics for all providers
func (m *ProviderManager) GetMetrics() map[ProviderType]ProviderMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	results := make(map[ProviderType]ProviderMetrics)
	
	for pt, p := range m.asrProviders {
		results[pt] = p.GetMetrics()
	}
	
	for pt, p := range m.translationProviders {
		results[pt] = p.GetMetrics()
	}
	
	for pt, p := range m.ttsProviders {
		results[pt] = p.GetMetrics()
	}
	
	return results
}
