# Pulse Monitor - Go SDK

Zero-dependency, high-performance API telemetry, security monitoring, and dashboard cockpit for Go backends. Compliant with **SPEC.md Wire Protocol v0.1.0**.

---

## ⚡ Features
- **Zero Third-Party Dependencies:** Built entirely with Go's standard library (`net/http`, `sync`, `regexp`).
- **Sub-Millisecond Overhead:** Thread-safe circular ring buffer with zero allocations on hot paths.
- **Privacy First:** Automatic redaction of sensitive headers (`Authorization`, `Cookie`, `X-Api-Key`) and body secrets (`password`, `token`, `secret`).
- **Security Watchdog:** Built-in threat detection for SQL Injection, XSS, Path Traversal, and sensitive file probing.
- **Embedded Real-Time Cockpit:** Single-page dashboard served directly at `/pulse` with Server-Sent Events (SSE).
- **Framework Agnostic:** Works with standard `net/http`, Gin, Echo, Chi, and Fiber.

---

## 🚀 Quickstart

### 1. Installation

```bash
go get github.com/alaminislam34/pulse-monitor/sdk/go
```

### 2. Standard `net/http` Integration

```go
package main

import (
	"log"
	"net/http"

	"github.com/alaminislam34/pulse-monitor/sdk/go/pulse"
)

func main() {
	// Initialize monitor
	m := pulse.NewMonitor(pulse.Config{
		ServiceName: "my-go-service",
		Environment: "development",
		BasePath:    "/pulse",
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"message":"hello world"}`))
	})

	// Wrap router with Pulse middleware
	handler := pulse.HTTPMiddleware(m)(mux)

	log.Println("⚡ Pulse Cockpit running at http://localhost:8080/pulse")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
```

---

### 3. Gin Integration

```go
package main

import (
	"github.com/gin-gonic/gin"
	"github.com/alaminislam34/pulse-monitor/sdk/go/pulse"
)

func main() {
	r := gin.Default()

	m := pulse.NewMonitor(pulse.Config{
		ServiceName: "gin-service",
		BasePath:    "/pulse",
	})

	// Mount Pulse dashboard and SSE stream
	r.Any("/pulse/*filepath", gin.WrapH(pulse.NewHandler(m)))

	// Or monitor all incoming traffic using standard middleware wrapper:
	// r.Use(gin.WrapH(...))

	r.Run(":8080")
}
```

---

## 📡 Wire Protocol Endpoints
Per **SPEC.md v0.1.0**, the Go SDK serves:
- `GET /pulse`: Modern developer cockpit UI.
- `GET /pulse/api/meta`: Service metadata and capabilities.
- `GET /pulse/api/events`: Historical request and threat events.
- `GET /pulse/api/stream`: Real-time SSE event stream.
- `GET /pulse/data`: Legacy dashboard backward compatibility.
