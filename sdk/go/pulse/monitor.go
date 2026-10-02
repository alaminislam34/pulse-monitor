package pulse

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Config holds configuration options for Pulse Monitor.
type Config struct {
	ServiceName           string `json:"serviceName"`
	Environment           string `json:"environment"`
	BasePath              string `json:"basePath"`
	OpenApiSpecUrl        string `json:"openApiSpecUrl"`
	MaxRequests           int    `json:"maxRequests"`
	MaxThreats            int    `json:"maxThreats"`
	SanitizePII           bool   `json:"sanitizePII"`
	EnableThreatDetection bool   `json:"enableThreatDetection"`
}

// DefaultConfig returns recommended default settings.
func DefaultConfig() Config {
	return Config{
		ServiceName:           "go-service",
		Environment:           "development",
		BasePath:              "/pulse",
		OpenApiSpecUrl:        "",
		MaxRequests:           1000,
		MaxThreats:            500,
		SanitizePII:           true,
		EnableThreatDetection: true,
	}
}

// RequestRecord represents an captured HTTP transaction.
type RequestRecord struct {
	ID              string            `json:"id"`
	Timestamp       int64             `json:"timestamp"`
	Method          string            `json:"method"`
	Path            string            `json:"path"`
	Status          int               `json:"status"`
	Duration        float64           `json:"duration"` // ms
	IP              string            `json:"ip"`
	RequestHeaders  map[string]string `json:"requestHeaders,omitempty"`
	ResponseHeaders map[string]string `json:"responseHeaders,omitempty"`
	RequestBody     string            `json:"requestBody,omitempty"`
	ResponseBody    string            `json:"responseBody,omitempty"`
	Drift           *DriftReport      `json:"drift,omitempty"`
}

// DriftReport holds schema contract drift status.
type DriftReport struct {
	Status  string   `json:"status"` // VERIFIED, DRIFT, UNDOCUMENTED
	Type    string   `json:"type,omitempty"`
	Message string   `json:"message,omitempty"`
	Diffs   []string `json:"diffs,omitempty"`
}

// CanonicalEvent wraps events per SPEC.md standard wire protocol.
type CanonicalEvent struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"` // request, threat, drift, metric
	Timestamp int64       `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// ProtocolMeta defines the standard metadata block per SPEC.md.
type ProtocolMeta struct {
	ServiceName    string                 `json:"serviceName"`
	Environment    string                 `json:"environment"`
	WireVersion    string                 `json:"wireVersion"`
	SDKName        string                 `json:"sdkName"`
	SDKVersion     string                 `json:"sdkVersion"`
	OpenApiSpecUrl string                 `json:"openApiSpecUrl,omitempty"`
	Capabilities   map[string]interface{} `json:"capabilities"`
}

// Monitor is the core stateful telemetry and security engine.
type Monitor struct {
	config         Config
	requests       *CircularBuffer[RequestRecord]
	threats        *CircularBuffer[ThreatEvent]
	threatDetector *ThreatDetector
	subMu          sync.RWMutex
	subscribers    map[chan CanonicalEvent]struct{}
	customHTML     string
}

// NewMonitor initializes a new Monitor instance.
func NewMonitor(cfg Config) *Monitor {
	if cfg.MaxRequests <= 0 {
		cfg.MaxRequests = 1000
	}
	if cfg.MaxThreats <= 0 {
		cfg.MaxThreats = 500
	}
	if cfg.BasePath == "" {
		cfg.BasePath = "/pulse"
	}
	if cfg.ServiceName == "" {
		cfg.ServiceName = "go-service"
	}
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}

	return &Monitor{
		config:         cfg,
		requests:       NewCircularBuffer[RequestRecord](cfg.MaxRequests),
		threats:        NewCircularBuffer[ThreatEvent](cfg.MaxThreats),
		threatDetector: NewThreatDetector(),
		subscribers:    make(map[chan CanonicalEvent]struct{}),
	}
}

// RecordRequest captures and processes an HTTP request/response cycle.
func (m *Monitor) RecordRequest(req RequestRecord, rawQuery string) {
	nowMs := time.Now().UnixMilli()
	if req.Timestamp == 0 {
		req.Timestamp = nowMs
	}
	if req.ID == "" {
		req.ID = fmt.Sprintf("req-%d", req.Timestamp)
	}

	// Threat Detection
	if m.config.EnableThreatDetection {
		detected := m.threatDetector.Analyze(req.Path, rawQuery, req.RequestBody, req.Timestamp)
		for _, threat := range detected {
			m.threats.Push(threat)
			m.BroadcastEvent(CanonicalEvent{
				ID:        threat.ID,
				Type:      "threat",
				Timestamp: threat.Timestamp,
				Data:      threat,
			})
		}
	}

	// Sanitization
	if m.config.SanitizePII {
		req.RequestHeaders = SanitizeHeaders(req.RequestHeaders)
		req.ResponseHeaders = SanitizeHeaders(req.ResponseHeaders)
		req.RequestBody = SanitizePayload(req.RequestBody)
		req.ResponseBody = SanitizePayload(req.ResponseBody)
	}

	m.requests.Push(req)

	// Broadcast canonical request event
	m.BroadcastEvent(CanonicalEvent{
		ID:        req.ID,
		Type:      "request",
		Timestamp: req.Timestamp,
		Data:      req,
	})
}

// SubscribeStream registers a channel for live SSE event broadcasts.
func (m *Monitor) SubscribeStream() (chan CanonicalEvent, func()) {
	ch := make(chan CanonicalEvent, 100)
	m.subMu.Lock()
	m.subscribers[ch] = struct{}{}
	m.subMu.Unlock()

	unsubscribe := func() {
		m.subMu.Lock()
		delete(m.subscribers, ch)
		close(ch)
		m.subMu.Unlock()
	}

	return ch, unsubscribe
}

// BroadcastEvent dispatches an event to all active SSE subscribers.
func (m *Monitor) BroadcastEvent(evt CanonicalEvent) {
	m.subMu.RLock()
	defer m.subMu.RUnlock()

	for ch := range m.subscribers {
		select {
		case ch <- evt:
		default:
			// Buffer full, drop to prevent hanging
		}
	}
}

// GetProtocolMeta returns metadata complying with SPEC.md.
func (m *Monitor) GetProtocolMeta() ProtocolMeta {
	return ProtocolMeta{
		ServiceName:    m.config.ServiceName,
		Environment:    m.config.Environment,
		WireVersion:    "0.1.0",
		SDKName:        "pulse-monitor-go",
		SDKVersion:     "0.1.0",
		OpenApiSpecUrl: m.config.OpenApiSpecUrl,
		Capabilities: map[string]interface{}{
			"streaming":       true,
			"threatDetection": m.config.EnableThreatDetection,
			"driftDetection":  false,
			"metrics":         true,
		},
	}
}

// GetCanonicalEvents returns the combined historical canonical event log.
func (m *Monitor) GetCanonicalEvents() []CanonicalEvent {
	var events []CanonicalEvent

	// Push requests
	for _, req := range m.requests.ToArray() {
		events = append(events, CanonicalEvent{
			ID:        req.ID,
			Type:      "request",
			Timestamp: req.Timestamp,
			Data:      req,
		})
	}

	// Push threats
	for _, th := range m.threats.ToArray() {
		events = append(events, CanonicalEvent{
			ID:        th.ID,
			Type:      "threat",
			Timestamp: th.Timestamp,
			Data:      th,
		})
	}

	return events
}

// GetLegacyData returns the dashboard compatibility object.
func (m *Monitor) GetLegacyData() map[string]interface{} {
	requests := m.requests.ToArray()
	threats := m.threats.ToArray()

	total := len(requests)
	totalDuration := 0.0
	errorCount := 0
	statusCounts := make(map[string]int)

	for _, r := range requests {
		totalDuration += r.Duration
		if r.Status >= 400 {
			errorCount++
		}
		statusGroup := fmt.Sprintf("%dxx", r.Status/100)
		statusCounts[statusGroup]++
	}

	avgDuration := 0.0
	if total > 0 {
		avgDuration = totalDuration / float64(total)
	}

	return map[string]interface{}{
		"system": map[string]interface{}{
			"serviceName": m.config.ServiceName,
			"environment": m.config.Environment,
			"timestamp":   time.Now().UnixMilli(),
		},
		"requests": requests,
		"threats":  threats,
		"analytics": map[string]interface{}{
			"totalRequests": total,
			"avgDuration":   avgDuration,
			"errorCount":    errorCount,
			"statusCounts":  statusCounts,
		},
	}
}

// SetCustomDashboardHTML provides an override for the dashboard single-file bundle.
func (m *Monitor) SetCustomDashboardHTML(html string) {
	m.customHTML = html
}

// GetDashboardHTML delivers the UI injected with window.__PULSE_CONFIG__.
func (m *Monitor) GetDashboardHTML() string {
	configJSON, _ := json.Marshal(map[string]interface{}{
		"basePath":       m.config.BasePath,
		"serviceName":    m.config.ServiceName,
		"environment":    m.config.Environment,
		"openApiSpecUrl": m.config.OpenApiSpecUrl,
		"streaming":      true,
	})

	injectionScript := fmt.Sprintf("<script>window.__PULSE_CONFIG__ = %s;</script>", string(configJSON))

	htmlContent := m.customHTML
	if htmlContent == "" {
		// Try to read dist/ui/index.html from standard locations
		paths := []string{
			"dist/ui/index.html",
			"../dist/ui/index.html",
			"../../dist/ui/index.html",
		}
		for _, p := range paths {
			abs, err := filepath.Abs(p)
			if err == nil {
				data, err := os.ReadFile(abs)
				if err == nil && len(data) > 0 {
					htmlContent = string(data)
					break
				}
			}
		}
	}

	if htmlContent == "" {
		htmlContent = fallbackDashboardHTML()
	}

	if strings.Contains(htmlContent, "</head>") {
		return strings.Replace(htmlContent, "</head>", injectionScript+"</head>", 1)
	}
	return injectionScript + htmlContent
}

func fallbackDashboardHTML() string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pulse Monitor Cockpit (Go)</title>
  <style>
    body { background: #0b0f19; color: #f8fafc; font-family: system-ui, sans-serif; padding: 2rem; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 1.5rem; max-width: 800px; margin: 0 auto; }
    h1 { color: #6366f1; margin-top: 0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(99,102,241,0.2); color: #818cf8; font-size: 0.875rem; }
    pre { background: #030712; padding: 1rem; border-radius: 8px; overflow-x: auto; color: #10b981; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h1>⚡ Pulse Monitor (Go)</h1>
      <span class="badge">SPEC v0.1.0 Ready</span>
    </div>
    <p>Connected to Go backend. Listening for live HTTP telemetry & security events.</p>
    <h3>Endpoints Active:</h3>
    <ul>
      <li><code>/pulse/api/meta</code>: Service metadata & capabilities</li>
      <li><code>/pulse/api/events</code>: Canonical wire events</li>
      <li><code>/pulse/api/stream</code>: Real-time Server-Sent Events (SSE)</li>
      <li><code>/pulse/data</code>: Legacy compatibility</li>
    </ul>
    <div id="live-feed">
      <h3>Live Events:</h3>
      <pre id="output">Waiting for traffic...</pre>
    </div>
  </div>
  <script>
    const output = document.getElementById('output');
    const evtSource = new EventSource(window.location.pathname.replace(/\/$/, '') + '/api/stream');
    evtSource.addEventListener('event', (e) => {
      output.innerText = e.data + '\n\n' + output.innerText;
    });
  </script>
</body>
</html>`
}
