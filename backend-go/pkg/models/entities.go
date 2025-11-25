package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Device represents a medical cart/device
type Device struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Model     string    `gorm:"size:50" json:"model"`
	Location  string    `gorm:"size:100" json:"location"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate hook to generate UUID
func (d *Device) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

// ClientPlan represents a customer's service plan configuration
type ClientPlan struct {
	ID                uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	ClientID          uuid.UUID `gorm:"type:uuid;not null" json:"client_id"`
	Name              string    `gorm:"size:100;not null" json:"name"`
	Mode              string    `gorm:"size:20;not null" json:"mode"` // 'segment' | 'stream' | 'hybrid'
	LatencyPriority   string    `gorm:"size:20;not null" json:"latency_priority"` // 'low' | 'balanced' | 'low_cost'
	ASRProvider       string    `gorm:"size:20;not null" json:"asr_provider"` // 'openai' | 'manus'
	ASRModel          string    `gorm:"size:50" json:"asr_model"`
	TranslateModel    string    `gorm:"size:50" json:"translate_model"`
	TTSModel          string    `gorm:"size:50" json:"tts_model"`
	MaxStreamRateMs   int       `json:"max_stream_rate_ms"`
	AllowStream       bool      `gorm:"default:false" json:"allow_stream"`
	CostPerMinute     float64   `gorm:"type:decimal(10,4);default:0" json:"cost_per_minute"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (cp *ClientPlan) BeforeCreate(tx *gorm.DB) error {
	if cp.ID == uuid.Nil {
		cp.ID = uuid.New()
	}
	return nil
}

// Session represents a conversation session
type Session struct {
	ID             uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	DeviceID       *uuid.UUID `gorm:"type:uuid" json:"device_id"`
	ClientPlanID   *uuid.UUID `gorm:"type:uuid" json:"client_plan_id"`
	StartedAt      time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"started_at"`
	EndedAt        *time.Time `json:"ended_at"`
	
	Device         *Device     `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
	ClientPlan     *ClientPlan `gorm:"foreignKey:ClientPlanID" json:"client_plan,omitempty"`
	Transcripts    []Transcript `gorm:"foreignKey:SessionID" json:"transcripts,omitempty"`
}

func (s *Session) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// Transcript represents an ASR result
type Transcript struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	SessionID  uuid.UUID `gorm:"type:uuid;not null" json:"session_id"`
	SourceLang string    `gorm:"size:5" json:"source_lang"`
	Text       string    `gorm:"type:text;not null" json:"text"`
	CreatedAt  time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	
	Session      *Session      `gorm:"foreignKey:SessionID" json:"session,omitempty"`
	Translations []Translation `gorm:"foreignKey:TranscriptID" json:"translations,omitempty"`
}

func (t *Transcript) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

// Translation represents a translation result
type Translation struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	TranscriptID   uuid.UUID `gorm:"type:uuid;not null" json:"transcript_id"`
	TargetLang     string    `gorm:"size:5" json:"target_lang"`
	TranslatedText string    `gorm:"type:text;not null" json:"translated_text"`
	TTSAudioURL    string    `gorm:"type:text" json:"tts_audio_url"`
	CreatedAt      time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	
	Transcript *Transcript `gorm:"foreignKey:TranscriptID" json:"transcript,omitempty"`
}

func (t *Translation) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

// Diagnostic represents performance metrics for a session
type Diagnostic struct {
	ID                uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	SessionID         uuid.UUID `gorm:"type:uuid;not null" json:"session_id"`
	ASRLatencyMs      int       `json:"asr_latency_ms"`
	TranslateLatencyMs int      `json:"translate_latency_ms"`
	TTSLatencyMs      int       `json:"tts_latency_ms"`
	UploadLatencyMs   int       `json:"upload_latency_ms"`
	ChunkDurationSec  float64   `gorm:"type:decimal(6,3)" json:"chunk_duration_sec"`
	ChunkSizeBytes    int       `json:"chunk_size_bytes"`
	E2ELatencyMs      int       `json:"e2e_latency_ms"`
	Bottleneck        string    `gorm:"size:50" json:"bottleneck"`
	Severity          string    `gorm:"size:10" json:"severity"` // 'green' | 'yellow' | 'red'
	CreatedAt         time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	
	Session *Session `gorm:"foreignKey:SessionID" json:"session,omitempty"`
}

func (d *Diagnostic) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
