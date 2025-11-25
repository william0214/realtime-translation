package rest

import (
	"realtime-translation-backend/internal/config"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRoutes sets up REST API routes
func SetupRoutes(router *gin.Engine, db *gorm.DB, cfg *config.Config) {
	api := router.Group("/api/v1")
	
	// Initialize handlers
	handlers := NewHandlers(db, cfg)
	
	// Health check
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"message": "Server is running",
		})
	})

	// ASR segment endpoint
	api.POST("/asr/segment", handlers.HandleSegment)
	
	// TODO: Add diagnostics endpoint
	// api.GET("/diagnostics/report", handleDiagnosticsReport)
	
	// TODO: Add device CRUD endpoints
	// api.GET("/devices", handleGetDevices)
	// api.POST("/devices", handleCreateDevice)
	
	// TODO: Add client plan endpoint
	// api.GET("/client-plan/:clientId", handleGetClientPlan)
}
