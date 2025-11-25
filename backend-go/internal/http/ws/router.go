package ws

import (
	"realtime-translation-backend/internal/config"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRoutes sets up WebSocket routes
func SetupRoutes(router *gin.Engine, db *gorm.DB, cfg *config.Config) {
	// Initialize handlers
	handlers := NewStreamHandlers(db, cfg)
	
	// WebSocket streaming endpoint
	router.GET("/ws/asr/stream", handlers.HandleStream)
}
