package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/alaminislam34/pulse-monitor/sdk/go/pulse"
)

func main() {
	// 1. Initialize Pulse Monitor with SPEC.md configuration
	m := pulse.NewMonitor(pulse.Config{
		ServiceName:           "user-api-go",
		Environment:           "development",
		BasePath:              "/pulse",
		MaxRequests:           1000,
		MaxThreats:            500,
		SanitizePII:           true,
		EnableThreatDetection: true,
	})

	// 2. Setup your application router
	mux := http.NewServeMux()

	// API Endpoints
	mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]map[string]interface{}{
			{"id": "usr-1", "name": "Alice Developer", "role": "admin"},
			{"id": "usr-2", "name": "Bob Builder", "role": "member"},
		})
	})

	mux.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
		// Mock login - sensitive fields like 'password' will be scrubbed automatically by Pulse Monitor
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"token":  "super-secret-jwt-token-12345",
		})
	})

	// 3. Wrap mux with Pulse HTTPMiddleware (monitors all traffic and serves /pulse cockpit)
	handler := pulse.HTTPMiddleware(m)(mux)

	fmt.Println("🚀 Go server running on http://localhost:8080")
	fmt.Println("⚡ Pulse Monitor cockpit available at http://localhost:8080/pulse")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
