package provider

import (
	"context"
	"time"
)

// ProviderType represents the type of service provider
type ProviderType string

const (
	// ASR Providers
	ProviderManusASR   ProviderType = "manus_asr"
	ProviderOpenAIASR  ProviderType = "openai_asr"
	ProviderGoogleASR  ProviderType = "google_asr"
	
	// Translation Providers
	ProviderOpenAITranslation ProviderType = "openai_translation"
	ProviderGoogleTranslation ProviderType = "google_translation"
	ProviderAzureTranslation  ProviderType = "azure_translation"
	ProviderDeepLTranslation  ProviderType = "deepl_translation"
	
	// TTS Providers
	ProviderOpenAITTS ProviderType = "openai_tts"
	ProviderAzureTTS  ProviderType = "azure_tts"
	ProviderGoogleTTS ProviderType = "google_tts"
)

// ServiceType represents the type of service
type ServiceType string

const (
	ServiceASR         ServiceType = "asr"
	ServiceTranslation ServiceType = "translation"
	ServiceTTS         ServiceType = "tts"
)

// ProviderMetrics contains metrics for a provider
type ProviderMetrics struct {
	RequestCount    int64         `json:"request_count"`
	SuccessCount    int64         `json:"success_count"`
	FailureCount    int64         `json:"failure_count"`
	TotalLatencyMs  int64         `json:"total_latency_ms"`
	AverageLatency  time.Duration `json:"average_latency"`
	LastRequestTime time.Time     `json:"last_request_time"`
	LastError       string        `json:"last_error,omitempty"`
}

// ProviderStatus represents the health status of a provider
type ProviderStatus string

const (
	StatusHealthy   ProviderStatus = "healthy"
	StatusDegraded  ProviderStatus = "degraded"
	StatusUnhealthy ProviderStatus = "unhealthy"
	StatusUnknown   ProviderStatus = "unknown"
)

// ProviderInfo contains information about a provider
type ProviderInfo struct {
	Type        ProviderType   `json:"type"`
	ServiceType ServiceType    `json:"service_type"`
	Name        string         `json:"name"`
	Status      ProviderStatus `json:"status"`
	Metrics     ProviderMetrics `json:"metrics"`
	Config      interface{}    `json:"config,omitempty"`
}

// BaseProvider is the interface that all service providers must implement
type BaseProvider interface {
	// GetType returns the provider type
	GetType() ProviderType
	
	// GetServiceType returns the service type
	GetServiceType() ServiceType
	
	// GetName returns a human-readable name
	GetName() string
	
	// HealthCheck verifies the provider is accessible
	HealthCheck(ctx context.Context) error
	
	// GetStatus returns the current status
	GetStatus() ProviderStatus
	
	// GetMetrics returns provider metrics
	GetMetrics() ProviderMetrics
	
	// UpdateMetrics updates provider metrics
	UpdateMetrics(latency time.Duration, success bool, err error)
}

// ProviderConfig is the base configuration for all providers
type ProviderConfig struct {
	Type        ProviderType          `json:"type"`
	Enabled     bool                  `json:"enabled"`
	Priority    int                   `json:"priority"` // Higher priority = preferred provider
	MaxRetries  int                   `json:"max_retries"`
	Timeout     time.Duration         `json:"timeout"`
	Credentials map[string]string     `json:"credentials,omitempty"`
	Options     map[string]interface{} `json:"options,omitempty"`
}

// FailoverStrategy defines how to handle provider failures
type FailoverStrategy string

const (
	// FailoverNone: No failover, return error immediately
	FailoverNone FailoverStrategy = "none"
	
	// FailoverNext: Try next available provider
	FailoverNext FailoverStrategy = "next"
	
	// FailoverAll: Try all available providers
	FailoverAll FailoverStrategy = "all"
	
	// FailoverRoundRobin: Distribute requests across providers
	FailoverRoundRobin FailoverStrategy = "round_robin"
)

// RoutingStrategy defines how to select providers
type RoutingStrategy string

const (
	// RoutingPriority: Use provider with highest priority
	RoutingPriority RoutingStrategy = "priority"
	
	// RoutingLanguage: Select based on language
	RoutingLanguage RoutingStrategy = "language"
	
	// RoutingCost: Select cheapest provider
	RoutingCost RoutingStrategy = "cost"
	
	// RoutingLatency: Select fastest provider
	RoutingLatency RoutingStrategy = "latency"
	
	// RoutingRoundRobin: Distribute evenly
	RoutingRoundRobin RoutingStrategy = "round_robin"
)

// ServiceConfig contains configuration for a service type
type ServiceConfig struct {
	ServiceType       ServiceType      `json:"service_type"`
	Providers         []ProviderConfig `json:"providers"`
	FailoverStrategy  FailoverStrategy `json:"failover_strategy"`
	RoutingStrategy   RoutingStrategy  `json:"routing_strategy"`
	LanguageProviders map[string]ProviderType `json:"language_providers,omitempty"` // Language-specific overrides
}

// ClientPlan represents a customer's service plan
type ClientPlan struct {
	ClientID     string                   `json:"client_id"`
	PlanName     string                   `json:"plan_name"`
	ASRConfig    ServiceConfig            `json:"asr_config"`
	TransConfig  ServiceConfig            `json:"translation_config"`
	TTSConfig    ServiceConfig            `json:"tts_config"`
	SLA          SLAConfig                `json:"sla"`
	CostTracking CostTrackingConfig       `json:"cost_tracking"`
	Metadata     map[string]interface{}   `json:"metadata,omitempty"`
}

// SLAConfig defines service level agreement parameters
type SLAConfig struct {
	MaxLatencyMs    int     `json:"max_latency_ms"`
	MinAvailability float64 `json:"min_availability"` // 0.0 - 1.0 (e.g., 0.99 = 99%)
	MaxErrorRate    float64 `json:"max_error_rate"`   // 0.0 - 1.0 (e.g., 0.01 = 1%)
}

// CostTrackingConfig defines cost tracking parameters
type CostTrackingConfig struct {
	Enabled        bool               `json:"enabled"`
	MonthlyBudget  float64            `json:"monthly_budget"`
	AlertThreshold float64            `json:"alert_threshold"` // 0.0 - 1.0 (e.g., 0.8 = 80%)
	CostPerUnit    map[ProviderType]float64 `json:"cost_per_unit,omitempty"`
}

// RequestContext contains context for a service request
type RequestContext struct {
	ClientID   string                 `json:"client_id"`
	Language   string                 `json:"language,omitempty"`
	Priority   int                    `json:"priority"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	StartTime  time.Time              `json:"start_time"`
}

// ProviderResponse is the base response from any provider
type ProviderResponse struct {
	Provider   ProviderType  `json:"provider"`
	Success    bool          `json:"success"`
	LatencyMs  int64         `json:"latency_ms"`
	Error      string        `json:"error,omitempty"`
	Timestamp  time.Time     `json:"timestamp"`
}
