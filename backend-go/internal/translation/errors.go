package translation

import "errors"

var (
	// ErrNoProviderAvailable is returned when no translation provider is configured
	ErrNoProviderAvailable = errors.New("no translation provider available")
	
	// ErrProviderNotFound is returned when the requested provider is not configured
	ErrProviderNotFound = errors.New("translation provider not found")
	
	// ErrInvalidLanguageCode is returned when an invalid language code is provided
	ErrInvalidLanguageCode = errors.New("invalid language code")
	
	// ErrTranslationFailed is returned when the translation request fails
	ErrTranslationFailed = errors.New("translation failed")
	
	// ErrAPIKeyMissing is returned when the API key is not configured
	ErrAPIKeyMissing = errors.New("API key is missing")
	
	// ErrRateLimitExceeded is returned when the provider's rate limit is exceeded
	ErrRateLimitExceeded = errors.New("rate limit exceeded")
)
