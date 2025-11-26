package handler

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"realtime-translation-backend/internal/provider"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

// WebSocketHandler handles WebSocket connections for hybrid ASR
type WebSocketHandler struct {
	providerManager *provider.ProviderManager
	connections     map[*websocket.Conn]*HybridASRHandler
	mu              sync.Mutex
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(providerManager *provider.ProviderManager) *WebSocketHandler {
	return &WebSocketHandler{
		providerManager: providerManager,
		connections:     make(map[*websocket.Conn]*HybridASRHandler),
	}
}

// HandleWebSocket handles WebSocket connections
func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()
	
	log.Printf("[WebSocket] New connection from %s", conn.RemoteAddr())
	
	// Create hybrid ASR handler
	clientID := r.URL.Query().Get("client_id")
	if clientID == "" {
		clientID = "default"
	}
	
	mode := HybridASRMode(r.URL.Query().Get("mode"))
	if mode == "" {
		mode = ModeHybrid
	}
	
	handler := NewHybridASRHandler(h.providerManager, clientID, mode)
	
	// Set callbacks
	handler.SetCallbacks(
		func(resp PartialTranscriptResponse) {
			h.sendPartialTranscript(conn, resp)
		},
		func(resp FinalTranscriptResponse) {
			h.sendFinalTranscript(conn, resp)
		},
		func(err error) {
			h.sendError(conn, err)
		},
	)
	
	// Register connection
	h.mu.Lock()
	h.connections[conn] = handler
	h.mu.Unlock()
	
	defer func() {
		h.mu.Lock()
		delete(h.connections, conn)
		h.mu.Unlock()
		handler.Stop()
		log.Printf("[WebSocket] Connection closed: %s", conn.RemoteAddr())
	}()
	
	// Handle messages
	for {
		var msg IncomingMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WebSocket] Error reading message: %v", err)
			}
			break
		}
		
		h.handleMessage(handler, msg)
	}
}

// IncomingMessage represents a message from the client
type IncomingMessage struct {
	Type       string `json:"type"`        // "audio_chunk", "config", "stop"
	AudioData  string `json:"audio_data"`  // Base64 encoded audio
	SampleRate int    `json:"sample_rate"` // Sample rate (e.g., 48000)
	Format     string `json:"format"`      // Audio format (e.g., "webm", "pcm")
	Config     *Config `json:"config,omitempty"`
}

// Config represents configuration for the ASR handler
type Config struct {
	Mode           string  `json:"mode"`            // "segment", "stream", "hybrid"
	SourceLang     string  `json:"source_lang"`     // Source language
	TargetLang     string  `json:"target_lang"`     // Target language
	VADThreshold   float64 `json:"vad_threshold"`   // VAD RMS threshold
	SilenceDuration int    `json:"silence_duration"` // Silence duration in ms
}

// handleMessage handles incoming messages
func (h *WebSocketHandler) handleMessage(handler *HybridASRHandler, msg IncomingMessage) {
	switch msg.Type {
	case "audio_chunk":
		// Decode base64 audio data
		audioData, err := base64.StdEncoding.DecodeString(msg.AudioData)
		if err != nil {
			log.Printf("[WebSocket] Failed to decode audio data: %v", err)
			return
		}
		
		// Process audio chunk
		err = handler.ProcessAudioChunk(audioData, msg.SampleRate, msg.Format)
		if err != nil {
			log.Printf("[WebSocket] Failed to process audio chunk: %v", err)
		}
		
	case "config":
		// Update configuration
		if msg.Config != nil {
			h.updateConfig(handler, msg.Config)
		}
		
	case "stop":
		// Stop processing
		handler.Stop()
		log.Printf("[WebSocket] Received stop signal")
		
	default:
		log.Printf("[WebSocket] Unknown message type: %s", msg.Type)
	}
}

// updateConfig updates the handler configuration
func (h *WebSocketHandler) updateConfig(handler *HybridASRHandler, config *Config) {
	if config.Mode != "" {
		handler.mode = HybridASRMode(config.Mode)
		log.Printf("[WebSocket] Updated mode to: %s", config.Mode)
	}
	
	if config.VADThreshold > 0 {
		handler.vadDetector.SetThreshold(config.VADThreshold)
		log.Printf("[WebSocket] Updated VAD threshold to: %.3f", config.VADThreshold)
	}
	
	// Add more config updates as needed
}

// sendPartialTranscript sends a partial transcript to the client
func (h *WebSocketHandler) sendPartialTranscript(conn *websocket.Conn, resp PartialTranscriptResponse) {
	msg := map[string]interface{}{
		"type":       "partial_transcript",
		"transcript": resp.Transcript,
		"confidence": resp.Confidence,
		"is_partial": resp.IsPartial,
		"timestamp":  resp.Timestamp,
		"latency_ms": resp.LatencyMs,
	}
	
	err := conn.WriteJSON(msg)
	if err != nil {
		log.Printf("[WebSocket] Failed to send partial transcript: %v", err)
	}
}

// sendFinalTranscript sends a final transcript to the client
func (h *WebSocketHandler) sendFinalTranscript(conn *websocket.Conn, resp FinalTranscriptResponse) {
	// Encode TTS audio data as base64
	ttsAudioBase64 := ""
	if len(resp.TTSAudioData) > 0 {
		ttsAudioBase64 = base64.StdEncoding.EncodeToString(resp.TTSAudioData)
	}
	
	msg := map[string]interface{}{
		"type":             "final_transcript",
		"transcript":       resp.Transcript,
		"detected_lang":    resp.DetectedLang,
		"translation":      resp.Translation,
		"target_lang":      resp.TargetLang,
		"tts_audio_data":   ttsAudioBase64,
		"timestamp":        resp.Timestamp,
		"asr_latency_ms":   resp.ASRLatencyMs,
		"trans_latency_ms": resp.TransLatencyMs,
		"tts_latency_ms":   resp.TTSLatencyMs,
		"total_latency_ms": resp.TotalLatencyMs,
	}
	
	err := conn.WriteJSON(msg)
	if err != nil {
		log.Printf("[WebSocket] Failed to send final transcript: %v", err)
	}
}

// sendError sends an error message to the client
func (h *WebSocketHandler) sendError(conn *websocket.Conn, err error) {
	msg := map[string]interface{}{
		"type":  "error",
		"error": err.Error(),
	}
	
	sendErr := conn.WriteJSON(msg)
	if sendErr != nil {
		log.Printf("[WebSocket] Failed to send error: %v", sendErr)
	}
}

// Broadcast sends a message to all connected clients
func (h *WebSocketHandler) Broadcast(message interface{}) {
	h.mu.Lock()
	defer h.mu.Unlock()
	
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WebSocket] Failed to marshal broadcast message: %v", err)
		return
	}
	
	for conn := range h.connections {
		err := conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			log.Printf("[WebSocket] Failed to broadcast to %s: %v", conn.RemoteAddr(), err)
		}
	}
}

// GetConnectionCount returns the number of active connections
func (h *WebSocketHandler) GetConnectionCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.connections)
}
