package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	AppEnv  string `yaml:"app_env"`
	AppPort string `yaml:"app_port"`

	DB DatabaseConfig `yaml:"database"`

	OpenAI OpenAIConfig `yaml:"openai"`
	Manus  ManusConfig  `yaml:"manus"`

	ASR ASRConfig `yaml:"asr"`
	TTS TTSConfig `yaml:"tts"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     string `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Name     string `yaml:"name"`
}

type OpenAIConfig struct {
	APIKey  string `yaml:"api_key"`
	BaseURL string `yaml:"base_url"`
}

type ManusConfig struct {
	APIKey  string `yaml:"api_key"`
	BaseURL string `yaml:"base_url"`
}

type ASRConfig struct {
	DefaultProvider string `yaml:"default_provider"` // "openai" or "manus"
}

type TTSConfig struct {
	DefaultModel string `yaml:"default_model"`
	OutputDir    string `yaml:"output_dir"`
}

func Load() (*Config, error) {
	cfg := &Config{}

	// Try to load from config.yaml
	if _, err := os.Stat("config.yaml"); err == nil {
		data, err := os.ReadFile("config.yaml")
		if err != nil {
			return nil, fmt.Errorf("failed to read config.yaml: %w", err)
		}

		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("failed to parse config.yaml: %w", err)
		}
	}

	// Override with environment variables
	if env := os.Getenv("APP_ENV"); env != "" {
		cfg.AppEnv = env
	}
	if port := os.Getenv("APP_PORT"); port != "" {
		cfg.AppPort = port
	}

	if dbHost := os.Getenv("DB_HOST"); dbHost != "" {
		cfg.DB.Host = dbHost
	}
	if dbPort := os.Getenv("DB_PORT"); dbPort != "" {
		cfg.DB.Port = dbPort
	}
	if dbUser := os.Getenv("DB_USER"); dbUser != "" {
		cfg.DB.User = dbUser
	}
	if dbPass := os.Getenv("DB_PASSWORD"); dbPass != "" {
		cfg.DB.Password = dbPass
	}
	if dbName := os.Getenv("DB_NAME"); dbName != "" {
		cfg.DB.Name = dbName
	}

	if apiKey := os.Getenv("OPENAI_API_KEY"); apiKey != "" {
		cfg.OpenAI.APIKey = apiKey
	}
	if baseURL := os.Getenv("OPENAI_BASE_URL"); baseURL != "" {
		cfg.OpenAI.BaseURL = baseURL
	}

	if apiKey := os.Getenv("MANUS_API_KEY"); apiKey != "" {
		cfg.Manus.APIKey = apiKey
	}
	if baseURL := os.Getenv("MANUS_BASE_URL"); baseURL != "" {
		cfg.Manus.BaseURL = baseURL
	}

	if provider := os.Getenv("DEFAULT_ASR_PROVIDER"); provider != "" {
		cfg.ASR.DefaultProvider = provider
	}

	// Set defaults
	if cfg.AppEnv == "" {
		cfg.AppEnv = "dev"
	}
	if cfg.AppPort == "" {
		cfg.AppPort = "8080"
	}
	if cfg.OpenAI.BaseURL == "" {
		cfg.OpenAI.BaseURL = "https://api.openai.com/v1"
	}
	if cfg.ASR.DefaultProvider == "" {
		cfg.ASR.DefaultProvider = "openai"
	}
	if cfg.TTS.DefaultModel == "" {
		cfg.TTS.DefaultModel = "tts-1"
	}
	if cfg.TTS.OutputDir == "" {
		cfg.TTS.OutputDir = "./tts_files"
	}

	return cfg, nil
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DB.Host, c.DB.Port, c.DB.User, c.DB.Password, c.DB.Name)
}
