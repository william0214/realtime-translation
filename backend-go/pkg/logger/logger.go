package logger

import (
	"log/slog"
	"os"
)

var log *slog.Logger

// Init initializes the logger
func Init() {
	log = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
}

// Get returns the logger instance
func Get() *slog.Logger {
	if log == nil {
		Init()
	}
	return log
}
