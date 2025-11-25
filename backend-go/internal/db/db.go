package db

import (
	"fmt"
	"realtime-translation-backend/internal/config"
	"realtime-translation-backend/pkg/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Init initializes the database connection
func Init(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.GetDSN()

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}

// RunMigrations runs GORM AutoMigrate for all models
func RunMigrations(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.Device{},
		&models.ClientPlan{},
		&models.Session{},
		&models.Transcript{},
		&models.Translation{},
		&models.Diagnostic{},
	)
}
