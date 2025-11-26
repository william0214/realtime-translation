package main

// PORT Configuration
// Centralized port management to prevent conflicts.
// See PORTS.md for detailed documentation.

const (
	// NodeJSApp is the main web application port (Vite + Express + tRPC)
	NodeJSApp = 3000

	// GoHybridASR is the WebSocket real-time speech recognition service port
	GoHybridASR = 8080

	// GoRESTAPI is the REST API for speech translation (DISABLED)
	GoRESTAPI = 8081
)

// GetPort returns the port from environment variable or default value
func GetPort(envKey string, defaultPort int) string {
	if port := os.Getenv(envKey); port != "" {
		return port
	}
	return strconv.Itoa(defaultPort)
}
