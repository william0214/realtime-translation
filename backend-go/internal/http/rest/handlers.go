package rest

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"realtime-translation-backend/internal/asr"
	"realtime-translation-backend/internal/config"
	"realtime-translation-backend/internal/translate"
	"realtime-translation-backend/internal/tts"
	"realtime-translation-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SegmentRequest struct {
	AudioData  []byte `json:"audio_data" binding:"required"`
	TargetLang string `json:"target_lang" binding:"required"`
	SessionID  string `json:"session_id"`
}

type SegmentResponse struct {
	TranscriptID   string `json:"transcript_id"`
	TranslationID  string `json:"translation_id"`
	SourceText     string `json:"source_text"`
	SourceLang     string `json:"source_lang"`
	TranslatedText string `json:"translated_text"`
	TTSAudioURL    string `json:"tts_audio_url"`
	Diagnostics    struct {
		ASRLatencyMs       int `json:"asr_latency_ms"`
		DetectLatencyMs    int `json:"detect_latency_ms"`
		TranslateLatencyMs int `json:"translate_latency_ms"`
		TTSLatencyMs       int `json:"tts_latency_ms"`
		E2ELatencyMs       int `json:"e2e_latency_ms"`
	} `json:"diagnostics"`
}

type Handlers struct {
	db               *gorm.DB
	cfg              *config.Config
	asrService       asr.ASRService
	translateService *translate.TranslateService
	ttsService       *tts.TTSService
}

func NewHandlers(db *gorm.DB, cfg *config.Config) *Handlers {
	return &Handlers{
		db:               db,
		cfg:              cfg,
		asrService:       asr.NewASRService(asr.ASRProviderOpenAI, cfg),
		translateService: translate.NewTranslateService(cfg),
		ttsService:       tts.NewTTSService(cfg),
	}
}

// HandleSegment processes a complete audio segment: ASR → Detect → Translate → TTS
func (h *Handlers) HandleSegment(c *gin.Context) {
	startTime := time.Now()

	// Parse multipart form
	if err := c.Request.ParseMultipartForm(16 << 20); err != nil { // 16 MB max
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse multipart form"})
		return
	}

	// Get audio file
	file, _, err := c.Request.FormFile("audio")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing audio file"})
		return
	}
	defer file.Close()

	audioData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read audio file"})
		return
	}

	// Get target language
	targetLang := c.PostForm("target_lang")
	if targetLang == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing target_lang"})
		return
	}

	// Get optional session_id
	sessionIDStr := c.PostForm("session_id")
	var sessionID *uuid.UUID
	if sessionIDStr != "" {
		parsed, err := uuid.Parse(sessionIDStr)
		if err == nil {
			sessionID = &parsed
		}
	}

	// Step 1: ASR (Speech-to-Text)
	sourceText, asrLatency, err := h.asrService.TranscribeWebM(c.Request.Context(), audioData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("ASR failed: %v", err)})
		return
	}

	// Step 2: Language Detection
	sourceLang, detectLatency, err := h.translateService.DetectLanguage(c.Request.Context(), sourceText)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Language detection failed: %v", err)})
		return
	}

	// Step 3: Translation
	translatedText, translateLatency, err := h.translateService.Translate(c.Request.Context(), sourceText, sourceLang, targetLang)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Translation failed: %v", err)})
		return
	}

	// Step 4: TTS (Text-to-Speech)
	audioFilePath, ttsLatency, err := h.ttsService.GenerateSpeech(c.Request.Context(), translatedText, targetLang)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TTS failed: %v", err)})
		return
	}

	ttsAudioURL := h.ttsService.GetAudioURL(audioFilePath)

	// Calculate E2E latency
	e2eLatency := int(time.Since(startTime).Milliseconds())

	// Save to database (if DB is available)
	var transcriptID, translationID uuid.UUID
	if h.db != nil && sessionID != nil {
		// Create transcript
		transcript := models.Transcript{
			SessionID:  *sessionID,
			SourceLang: sourceLang,
			Text:       sourceText,
		}
		if err := h.db.Create(&transcript).Error; err == nil {
			transcriptID = transcript.ID

			// Create translation
			translation := models.Translation{
				TranscriptID:   transcript.ID,
				TargetLang:     targetLang,
				TranslatedText: translatedText,
				TTSAudioURL:    ttsAudioURL,
			}
			if err := h.db.Create(&translation).Error; err == nil {
				translationID = translation.ID
			}

			// Save diagnostics
			diagnostic := models.Diagnostic{
				SessionID:          *sessionID,
				ASRLatencyMs:       asrLatency,
				TranslateLatencyMs: detectLatency + translateLatency,
				TTSLatencyMs:       ttsLatency,
				E2ELatencyMs:       e2eLatency,
			}
			h.db.Create(&diagnostic)
		}
	}

	// Build response
	response := SegmentResponse{
		TranscriptID:   transcriptID.String(),
		TranslationID:  translationID.String(),
		SourceText:     sourceText,
		SourceLang:     sourceLang,
		TranslatedText: translatedText,
		TTSAudioURL:    ttsAudioURL,
	}
	response.Diagnostics.ASRLatencyMs = asrLatency
	response.Diagnostics.DetectLatencyMs = detectLatency
	response.Diagnostics.TranslateLatencyMs = translateLatency
	response.Diagnostics.TTSLatencyMs = ttsLatency
	response.Diagnostics.E2ELatencyMs = e2eLatency

	c.JSON(http.StatusOK, response)
}
