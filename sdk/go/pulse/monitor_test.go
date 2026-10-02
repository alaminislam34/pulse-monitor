package pulse_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alaminislam34/server-monitor/sdk/go/pulse"
)

func TestCircularBuffer(t *testing.T) {
	buf := pulse.NewCircularBuffer[int](3)

	buf.Push(1)
	buf.Push(2)
	buf.Push(3)
	arr := buf.ToArray()
	if len(arr) != 3 || arr[0] != 1 || arr[2] != 3 {
		t.Fatalf("Expected [1, 2, 3], got %v", arr)
	}

	// Overwrite oldest
	buf.Push(4)
	arr = buf.ToArray()
	if len(arr) != 3 || arr[0] != 2 || arr[2] != 4 {
		t.Fatalf("Expected [2, 3, 4], got %v", arr)
	}
}

func TestThreatDetection(t *testing.T) {
	td := pulse.NewThreatDetector()

	// SQL Injection
	threats := td.Analyze("/api/users", "id=1' OR '1'='1", "", 1000)
	if len(threats) == 0 || threats[0].Type != "SQL_INJECTION" {
		t.Fatalf("Expected SQL_INJECTION, got %v", threats)
	}

	// XSS
	threats = td.Analyze("/search", "q=<script>alert('pwned')</script>", "", 1000)
	if len(threats) == 0 || threats[0].Type != "XSS" {
		t.Fatalf("Expected XSS, got %v", threats)
	}

	// Path Traversal
	threats = td.Analyze("/download/../../etc/passwd", "", "", 1000)
	if len(threats) == 0 || threats[0].Type != "PATH_TRAVERSAL" {
		t.Fatalf("Expected PATH_TRAVERSAL, got %v", threats)
	}

	// Sensitive file
	threats = td.Analyze("/.env", "", "", 1000)
	if len(threats) == 0 || threats[0].Type != "SENSITIVE_FILE" {
		t.Fatalf("Expected SENSITIVE_FILE, got %v", threats)
	}
}

func TestSanitization(t *testing.T) {
	headers := map[string]string{
		"Authorization": "Bearer super-secret-jwt",
		"Content-Type":  "application/json",
		"Cookie":        "session=abc123xyz",
	}

	cleaned := pulse.SanitizeHeaders(headers)
	if cleaned["Authorization"] != "[REDACTED]" {
		t.Fatalf("Expected Authorization to be redacted, got %s", cleaned["Authorization"])
	}
	if cleaned["Cookie"] != "[REDACTED]" {
		t.Fatalf("Expected Cookie to be redacted, got %s", cleaned["Cookie"])
	}
	if cleaned["Content-Type"] != "application/json" {
		t.Fatalf("Content-Type should not be redacted, got %s", cleaned["Content-Type"])
	}

	rawJSON := `{"username":"alice","password":"mysecretpassword123","token":"xyz"}`
	cleanJSON := pulse.SanitizePayload(rawJSON)
	if strings.Contains(cleanJSON, "mysecretpassword123") {
		t.Fatalf("Password should have been redacted in JSON: %s", cleanJSON)
	}
	if !strings.Contains(cleanJSON, "[REDACTED]") {
		t.Fatalf("Expected [REDACTED] in sanitized JSON: %s", cleanJSON)
	}
}

func TestMonitorMiddlewareAndEndpoints(t *testing.T) {
	m := pulse.NewMonitor(pulse.Config{
		ServiceName: "test-go-service",
		Environment: "test",
		BasePath:    "/pulse",
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"message":"hello world"}`))
	})

	handler := pulse.HTTPMiddleware(m)(mux)

	// 1. Send normal API request
	req := httptest.NewRequest("GET", "/api/hello", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	// 2. Query /pulse/api/meta
	reqMeta := httptest.NewRequest("GET", "/pulse/api/meta", nil)
	wMeta := httptest.NewRecorder()
	handler.ServeHTTP(wMeta, reqMeta)

	if wMeta.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for meta, got %d", wMeta.Code)
	}

	var meta pulse.ProtocolMeta
	if err := json.Unmarshal(wMeta.Body.Bytes(), &meta); err != nil {
		t.Fatalf("Failed to parse meta json: %v", err)
	}
	if meta.ServiceName != "test-go-service" || meta.WireVersion != "0.1.0" {
		t.Fatalf("Invalid meta payload: %+v", meta)
	}

	// 3. Query /pulse/api/events
	reqEvts := httptest.NewRequest("GET", "/pulse/api/events", nil)
	wEvts := httptest.NewRecorder()
	handler.ServeHTTP(wEvts, reqEvts)

	if wEvts.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for events, got %d", wEvts.Code)
	}

	var evtsWrapper struct {
		Events []pulse.CanonicalEvent `json:"events"`
	}
	if err := json.Unmarshal(wEvts.Body.Bytes(), &evtsWrapper); err != nil {
		t.Fatalf("Failed to parse events json: %v", err)
	}
	if len(evtsWrapper.Events) == 0 {
		t.Fatalf("Expected at least 1 recorded request event")
	}

	// 4. Query /pulse dashboard HTML
	reqUI := httptest.NewRequest("GET", "/pulse", nil)
	wUI := httptest.NewRecorder()
	handler.ServeHTTP(wUI, reqUI)

	if wUI.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for UI, got %d", wUI.Code)
	}
	if !strings.Contains(wUI.Body.String(), "window.__PULSE_CONFIG__") {
		t.Fatalf("Expected window.__PULSE_CONFIG__ injected into HTML")
	}
}
