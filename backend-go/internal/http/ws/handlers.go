package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"realtime-translation-backend/internal/asr"
	"realtime-translation-backend/internal/config"
	"realtime-translation-backend/internal/translate"
	"realtime-translation-backend/internal/tts"
	"realtime-translation-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024 * 16, // 16 KB
	WriteBufferSize: 1024 * 16,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins (configure properly in production)
	},
}

type StreamHandlers struct {
	db               *gorm.DB
	cfg              *config.Config
	asrService       asr.ASRService
	translateService *translate.TranslateService
	ttsService       *tts.TTSService
}

func NewStreamHandlers(db *gorm.DB, cfg *config.Config) *StreamHandlers {
	return &StreamHandlers{
		db:               db,
		cfg:              cfg,
		asrService:       asr.NewASRService(asr.ASRProviderOpenAI, cfg),
		translateService: translate.NewTranslateService(cfg),
		ttsService:       tts.NewTTSService(cfg),
	}
}

// Message types
type ClientMessage struct {
	Type       string `json:"type"` // "start", "audio", "end"
	SessionID  string `json:"session_id,omitempty"`
	TargetLang string `json:"target_lang,omitempty"`
	AudioData  []byte `json:"audio_data,omitempty"`
}

type ServerMessage struct {
	Type           string `json:"type"` // "transcript", "translation", "error", "diagnostics"
	TranscriptID   string `json:"transcript_id,omitempty"`
	TranslationID  string `json:"translation_id,omitempty"`
	SourceText     string `json:"source_text,omitempty"`
	SourceLang     string `json:"source_lang,omitempty"`
	TranslatedText string `json:"translated_text,omitempty"`
	TTSAudioURL    string `json:"tts_audio_url,omitempty"`
	Error          string `json:"error,omitempty"`
	Diagnostics    *struct {
		ASRLatencyMs       int `json:"asr_latency_ms"`
		DetectLatencyMs    int `json:"detect_latency_ms"`
		TranslateLatencyMs int `json:"translate_latency_ms"`
		TTSLatencyMs       int `json:"tts_latency_ms"`
		E2ELatencyMs       int `json:"e2e_latency_ms"`
	} `json:"diagnostics,omitempty"`
}

// HandleStream handles WebSocket streaming connections
func (h *StreamHandlers) HandleStream(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	var sessionID *uuid.UUID
	var targetLang string

	for {
		// Read message from client
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse client message
		var clientMsg ClientMessage
		if err := json.Unmarshal(message, &clientMsg); err != nil {
			h.sendError(conn, "Invalid message format")
			continue
		}

		switch clientMsg.Type {
		case "start":
			// Initialize session
			if clientMsg.SessionID != "" {
				parsed, err := uuid.Parse(clientMsg.SessionID)
				if err == nil {
					sessionID = &parsed
				}
			}
			if clientMsg.TargetLang != "" {
				targetLang = clientMsg.TargetLang
			}

			// Send acknowledgment
			h.sendMessage(conn, ServerMessage{
				Type: "started",
			})

		case "audio":
			// Process audio chunk
			if targetLang == "" {
				h.sendError(conn, "Target language not set")
				continue
			}

			startTime := time.Now()

			// Step 1: ASR
			sourceText, asrLatency, err := h.asrService.TranscribeWebM(context.Background(), clientMsg.AudioData)
			if err != nil {
				h.sendError(conn, fmt.Sprintf("ASR failed: %v", err))
				continue
			}

			// Send transcript immediately
			h.sendMessage(conn, ServerMessage{
				Type:       "transcript",
				SourceText: sourceText,
			})

			// Step 2: Language Detection
			sourceLang, detectLatency, err := h.translateService.DetectLanguage(context.Background(), sourceText)
			if err != nil {
				h.sendError(conn, fmt.Sprintf("Language detection failed: %v", err))
				continue
			}

			// Step 3: Translation
			translatedText, translateLatency, err := h.translateService.Translate(context.Background(), sourceText, sourceLang, targetLang)
			if err != nil {
				h.sendError(conn, fmt.Sprintf("Translation failed: %v", err))
				continue
			}

			// Step 4: TTS
			audioFilePath, ttsLatency, err := h.ttsService.GenerateSpeech(context.Background(), translatedText, targetLang)
			if err != nil {
				h.sendError(conn, fmt.Sprintf("TTS failed: %v", err))
				continue
			}

			ttsAudioURL := h.ttsService.GetAudioURL(audioFilePath)

			// Calculate E2E latency
			e2eLatency := int(time.Since(startTime).Milliseconds())

			// Save to database
			var transcriptID, translationID uuid.UUID
			if h.db != nil && sessionID != nil {
				transcript := models.Transcript{
					SessionID:  *sessionID,
					SourceLang: sourceLang,
					Text:       sourceText,
				}
				if err := h.db.Create(&transcript).Error; err == nil {
					transcriptID = transcript.ID

					translation := models.Translation{
						TranscriptID:   transcript.ID,
						TargetLang:     targetLang,
						TranslatedText: translatedText,
						TTSAudioURL:    ttsAudioURL,
					}
					if err := h.db.Create(&translation).Error; err == nil {
						translationID = translation.ID
					}

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

			// Send translation result
			response := ServerMessage{
				Type:           "translation",
				TranscriptID:   transcriptID.String(),
				TranslationID:  translationID.String(),
				SourceText:     sourceText,
				SourceLang:     sourceLang,
				TranslatedText: translatedText,
				TTSAudioURL:    ttsAudioURL,
				Diagnostics: &struct {
					ASRLatencyMs       int `json:"asr_latency_ms"`
					DetectLatencyMs    int `json:"detect_latency_ms"`
					TranslateLatencyMs int `json:"translate_latency_ms"`
					TTSLatencyMs       int `json:"tts_latency_ms"`
					E2ELatencyMs       int `json:"e2e_latency_ms"`
				}{
					ASRLatencyMs:       asrLatency,
					DetectLatencyMs:    detectLatency,
					TranslateLatencyMs: translateLatency,
					TTSLatencyMs:       ttsLatency,
					E2ELatencyMs:       e2eLatency,
				},
			}

			h.sendMessage(conn, response)

		case "end":
			// End session
			h.sendMessage(conn, ServerMessage{
				Type: "ended",
			})
			return

		default:
			h.sendError(conn, "Unknown message type")
		}
	}
}

func (h *StreamHandlers) sendMessage(conn *websocket.Conn, msg ServerMessage) {
	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("Failed to send message: %v", err)
	}
}

func (h *StreamHandlers) sendError(conn *websocket.Conn, errMsg string) {
	h.sendMessage(conn, ServerMessage{
		Type:  "error",
		Error: errMsg,
	})
}
