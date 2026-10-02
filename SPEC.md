# Pulse Monitor Wire Protocol Specification (`SPEC.md`)
**Version:** `0.1.0-draft`  
**Status:** Working Draft  
**Target:** Language-Agnostic Local-First API Observability & Drift Detection

---

## 1. Overview & Architecture

Pulse Monitor adopts the **Swagger model**: a single, reusable, ultra-fast web client combined with a lightweight, standardized JSON/SSE data contract. Any backend language (Node.js, Python, Go, Java, .NET, Rust, PHP) or a standalone sidecar proxy implements this specification to gain instant zero-config dashboard visualization.

```
┌────────────────────────────────────────────────────────┐
│               Backend App (Any Language)               │
│                                                        │
│  [App Routes]       [Pulse Middleware / Proxy]         │
│       │                         │                      │
│       │ (telemetry hook)        │ In-Memory RingBuffer │
│       └────────────────────────►│ (Circular Buffer)    │
│                                 │                      │
│                                 ▼                      │
│                    Exposes Standard Endpoints:         │
│                    - GET /pulse                        │
│                    - GET /pulse/api/meta               │
│                    - GET /pulse/api/events             │
│                    - GET /pulse/api/stream (SSE)       │
└─────────────────────────────────┬──────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────┐
│           Pulse UI Engine (Language Agnostic)          │
│    Compiled Single-file HTML / Web Component (<100KB)  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Standard Endpoints

Every compliant Pulse provider (middleware or proxy) MUST expose the following endpoints under a configurable prefix (default: `/pulse`):

### 2.1. `GET /pulse`
- **Content-Type:** `text/html; charset=utf-8`
- **Description:** Returns the standalone, pre-compiled Pulse UI client.
- **Header Injection:** May inject a meta tag or window config:
  ```html
  <script>
    window.__PULSE_CONFIG__ = {
      apiPrefix: "/pulse/api",
      streamPrefix: "/pulse/api/stream",
      openApiUrl: "/openapi.json"
    };
  </script>
  ```

### 2.2. `GET /pulse/api/meta`
- **Content-Type:** `application/json`
- **Description:** Returns metadata describing the host environment.
```json
{
  "protocolVersion": "0.1.0",
  "runtime": {
    "language": "python",
    "framework": "fastapi",
    "version": "0.110.0"
  },
  "serviceName": "inventory-api",
  "bufferSize": 1000,
  "features": {
    "threatDetection": true,
    "openApiDrift": true,
    "payloadInspection": true
  },
  "openApiSpecUrl": "/openapi.json"
}
```

### 2.3. `GET /pulse/api/events`
- **Content-Type:** `application/json`
- **Query Parameters:**
  - `limit`: (default: 100, max: 1000)
  - `since`: Epoch millisecond timestamp
  - `type`: `all` | `request` | `threat` | `drift`
- **Description:** Dumps historical events stored in the in-memory circular ring buffer.

### 2.4. `GET /pulse/api/stream`
- **Content-Type:** `text/event-stream`
- **Headers:**
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- **Description:** Real-time push of telemetry events via Server-Sent Events (SSE).
- **Heartbeat:** Sends a comment line `:ping` every 15 seconds if no events occur.

---

## 3. Canonical Event Schemas

All events are encoded as JSON. Every event MUST have an `id`, `type`, and `timestamp`.

### 3.1. `request` Event
Emitted on completion of an HTTP request cycle.

```json
{
  "id": "req_01HPX7K980ABCDEF",
  "type": "request",
  "timestamp": 1727850000000,
  "request": {
    "method": "POST",
    "path": "/api/v1/orders",
    "routePattern": "/api/v1/orders",
    "query": { "discount": "PROMO2026" },
    "headers": {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 ...",
      "authorization": "[REDACTED]"
    },
    "ip": "127.0.0.1",
    "body": "{\"item\":\"laptop\",\"quantity\":1}",
    "inferredSchema": "{ item: string; quantity: number }"
  },
  "response": {
    "statusCode": 201,
    "durationMs": 14.8,
    "headers": {
      "content-type": "application/json"
    },
    "body": "{\"orderId\":\"ord_9981\",\"status\":\"confirmed\"}",
    "inferredSchema": "{ orderId: string; status: string }"
  },
  "drift": {
    "isDocumented": true,
    "matchedOpenApiPath": "/api/v1/orders",
    "hasSchemaMismatch": false
  }
}
```

### 3.2. `threat` Event
Emitted when security heuristics or pattern matchers identify suspicious payload signatures.

```json
{
  "id": "thr_01HPX7M230GHIJKL",
  "type": "threat",
  "timestamp": 1727850000100,
  "requestId": "req_01HPX7K980ABCDEF",
  "threatType": "SQLI",
  "severity": "CRITICAL",
  "targetField": "query.id",
  "matchedPattern": "' OR 1=1 --",
  "clientIp": "192.168.1.105",
  "userAgent": "sqlmap/1.7#stable"
}
```
*Supported `threatType`:* `SQLI`, `XSS`, `PATH_TRAVERSAL`, `SUSPICIOUS_UA`, `PROTOTYPE_POLLUTION`.

### 3.3. `drift` Event (OpenAPI Contract Drift)
Emitted when a live request deviates from the provided OpenAPI / Swagger spec.

```json
{
  "id": "drf_01HPX7P450MNOPQR",
  "type": "drift",
  "timestamp": 1727850000200,
  "requestId": "req_01HPX7K980ABCDEF",
  "driftCategory": "UNDOCUMENTED_FIELD",
  "severity": "WARNING",
  "endpoint": "POST /api/v1/orders",
  "description": "Response contains unexpected property 'legacyTaxId' not in OpenAPI schema definition",
  "diff": {
    "field": "response.body.legacyTaxId",
    "expected": "undefined",
    "actual": "string"
  }
}
```

### 3.4. `metric` Event (System Pulse)
Emitted periodically (e.g., every 2–5 seconds) to feed the live dashboard charts.

```json
{
  "id": "met_01HPX7R670STUVWX",
  "type": "metric",
  "timestamp": 1727850005000,
  "cpuPercent": 4.2,
  "memoryBytes": 68157440,
  "activeConnections": 12,
  "eventLoopLagMs": 1.4,
  "requestsPerSecond": 45.6
}
```

---

## 4. Privacy, Security & Sanitization Rules

A telemetry tool that leaks credentials loses developer trust instantly. Compliant Pulse implementations MUST follow these security guarantees:

1. **Header Redaction:**
   - Any header matching `authorization`, `cookie`, `set-cookie`, `x-api-key`, `jwt`, `token` (case-insensitive) MUST have its value replaced with `"[REDACTED]"`.
2. **Payload Masking:**
   - JSON keys matching `password`, `passwd`, `secret`, `credit_card`, `cvv`, `token`, `ssn` MUST have their values masked with `"[REDACTED]"`.
3. **Payload Truncation:**
   - Bodies larger than `maxBodySizeKb` (default: 64 KB) MUST be truncated with a clear marker: `[Truncated at 64KB]`.
4. **Stealth & Auth:**
   - If `authSecret` is configured, `/pulse` endpoints require a Bearer token or cookie session.
