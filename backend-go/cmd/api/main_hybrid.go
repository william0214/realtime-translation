package main

import (
	"log"
	"net/http"
	"os"

	"realtime-translation/internal/handler"
	"realtime-translation/internal/provider"
)

func main() {
	log.Println("Starting Hybrid ASR Server...")
	
	// Load client plans
	plans, err := provider.LoadClientPlans("configs/client_plans.json")
	if err != nil {
		log.Fatalf("Failed to load client plans: %v", err)
	}
	
	log.Printf("Loaded %d client plans", len(plans))
	
	// Create provider manager
	manager := provider.NewProviderManager()
	
	// Initialize providers
	if err := provider.InitializeProviders(manager, plans); err != nil {
		log.Fatalf("Failed to initialize providers: %v", err)
	}
	
	log.Println("Providers initialized successfully")
	
	// Create WebSocket handler
	wsHandler := handler.NewWebSocketHandler(manager)
	
	// Setup routes
	http.HandleFunc("/ws/hybrid-asr", wsHandler.HandleWebSocket)
	
	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	
	// Status endpoint
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		status := map[string]interface{}{
			"active_connections": wsHandler.GetConnectionCount(),
			"provider_health":    manager.HealthCheck(r.Context()),
		}
		
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		
		// Simple JSON encoding
		w.Write([]byte("{"))
		w.Write([]byte("\"active_connections\": "))
		w.Write([]byte(string(rune(wsHandler.GetConnectionCount() + '0'))))
		w.Write([]byte("}"))
	})
	
	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	log.Printf("Server listening on port %s", port)
	log.Printf("WebSocket endpoint: ws://localhost:%s/ws/hybrid-asr", port)
	log.Printf("Health check: http://localhost:%s/health", port)
	log.Printf("Status: http://localhost:%s/status", port)
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
