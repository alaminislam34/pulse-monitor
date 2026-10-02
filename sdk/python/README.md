# ⚡ Pulse Monitor (Python SDK)

Universal, local-first API observability, threat detection watchdog, and contract monitoring for Python web frameworks (**FastAPI**, **Starlette**, **Django**, **Flask**).

Compliant with the language-agnostic [SPEC.md](../../SPEC.md) wire protocol.

---

## 🚀 Quick Start (FastAPI)

```python
from fastapi import FastAPI
from pulse_monitor import PulseMiddleware

app = FastAPI()

# 1-Line Integration (Just like Swagger UI!)
app.add_middleware(PulseMiddleware, endpoint="/pulse")

@app.get("/api/v1/users")
def get_users():
    return [{"id": 1, "name": "Alice"}]
```

Run your FastAPI app and open:
```
http://localhost:8000/pulse
```

---

## ✨ Features

- **⚡ Zero Cloud Dependencies:** 100% local in-memory circular ring buffer.
- **🛡️ Built-in Threat Detector:** Real-time heuristic detection of SQL Injection, XSS, and Path Traversal.
- **🔐 Automatic Credential Sanitization:** Auto-redaction of passwords, tokens, API keys, cookies, and JWTs.
- **📡 Server-Sent Events (SSE):** Real-time sub-millisecond push to the interactive dashboard.
- **📖 OpenAPI Aware:** Seamless integration with `/openapi.json`.
