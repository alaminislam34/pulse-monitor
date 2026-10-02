package pulse

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// responseWriter intercepts status code and body for telemetry capture.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if rw.statusCode == 0 {
		rw.statusCode = http.StatusOK
	}
	rw.body.Write(b)
	return rw.ResponseWriter.Write(b)
}

// HTTPMiddleware creates a standard net/http middleware handler.
func HTTPMiddleware(m *Monitor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			basePath := m.config.BasePath

			// Check if request is targeting Pulse Monitor UI or API
			if strings.HasPrefix(r.URL.Path, basePath) {
				handlePulseRoute(m, w, r)
				return
			}

			// Read request body non-destructively
			var reqBody string
			if r.Body != nil {
				bodyBytes, err := io.ReadAll(r.Body)
				if err == nil {
					reqBody = string(bodyBytes)
					r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				}
			}

			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				body:           &bytes.Buffer{},
			}

			start := time.Now()
			next.ServeHTTP(rw, r)
			duration := float64(time.Since(start).Microseconds()) / 1000.0

			// Extract headers
			reqHeaders := make(map[string]string)
			for k, v := range r.Header {
				if len(v) > 0 {
					reqHeaders[k] = v[0]
				}
			}

			resHeaders := make(map[string]string)
			for k, v := range rw.Header() {
				if len(v) > 0 {
					resHeaders[k] = v[0]
				}
			}

			// Extract IP
			clientIP := r.RemoteAddr
			if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
				parts := strings.Split(forwarded, ",")
				clientIP = strings.TrimSpace(parts[0])
			}

			m.RecordRequest(RequestRecord{
				ID:              fmt.Sprintf("req-%d", start.UnixMilli()),
				Timestamp:       start.UnixMilli(),
				Method:          r.Method,
				Path:            r.URL.Path,
				Status:          rw.statusCode,
				Duration:        duration,
				IP:              clientIP,
				RequestHeaders:  reqHeaders,
				ResponseHeaders: resHeaders,
				RequestBody:     reqBody,
				ResponseBody:    rw.body.String(),
			}, r.URL.RawQuery)
		})
	}
}

// handlePulseRoute serves the dashboard UI, SSE stream, and API endpoints.
func handlePulseRoute(m *Monitor, w http.ResponseWriter, r *http.Request) {
	basePath := m.config.BasePath
	subPath := strings.TrimPrefix(r.URL.Path, basePath)
	subPath = strings.TrimPrefix(subPath, "/")

	switch subPath {
	case "", "index.html":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(m.GetDashboardHTML()))

	case "api/meta":
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(m.GetProtocolMeta())

	case "api/events":
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"events": m.GetCanonicalEvents(),
		})

	case "api/stream":
		handleSSE(m, w, r)

	case "data":
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(m.GetLegacyData())

	default:
		http.NotFound(w, r)
	}
}

// handleSSE serves real-time Server-Sent Events per SPEC.md.
func handleSSE(m *Monitor, w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ch, unsubscribe := m.SubscribeStream()
	defer unsubscribe()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			// Keep-alive ping comment
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case evt, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(evt)
			if err == nil {
				fmt.Fprintf(w, "event: event\ndata: %s\n\n", string(data))
				flusher.Flush()
			}
		}
	}
}

// NewHandler returns an http.Handler that directly serves Pulse endpoints.
// Useful for mounting on Gin, Chi, Echo, or standard http.ServeMux.
func NewHandler(m *Monitor) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlePulseRoute(m, w, r)
	})
}
