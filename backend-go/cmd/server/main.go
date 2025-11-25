package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"realtime-translation-backend/internal/config"
	"realtime-translation-backend/internal/db"
	"realtime-translation-backend/internal/http/rest"
	"realtime-translation-backend/internal/http/ws"
	"realtime-translation-backend/pkg/logger"
	"realtime-translation-backend/pkg/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize logger
	logger.Init()
	log := logger.Get()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// Initialize database
	database, err := db.Init(cfg)
	if err != nil {
		log.Warn("Failed to initialize database (will continue without DB)", "error", err)
		database = nil
	} else {
		// Run migrations
		if err := db.RunMigrations(database); err != nil {
			log.Warn("Failed to run migrations", "error", err)
		}
	}

	// Setup Gin
	if cfg.AppEnv == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS())

	// Setup routes
	rest.SetupRoutes(router, database, cfg)
	ws.SetupRoutes(router, database, cfg)

	// Start server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.AppPort),
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Info("Starting server", "port", cfg.AppPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("Failed to start server", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("Server forced to shutdown", "error", err)
	}

	log.Info("Server exited")
}
