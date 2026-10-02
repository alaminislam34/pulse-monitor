"""
Pulse Monitor - Universal Local-First Telemetry & API Observability
Compliant with SPEC.md (v0.1.0-draft)
"""

import os
import re
import sys
import time
import json
from collections import deque
from typing import Dict, Any, List, Optional, Callable


SENSITIVE_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key", "jwt", "token"}
SENSITIVE_KEYS = {"password", "passwd", "secret", "credit_card", "cvv", "token", "ssn", "apikey", "api_key"}

SQLI_REGEX = re.compile(
    r"(\b(union\s+select|select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table)\b|--|/\*|\*/|'\s*(or|and)\s+\d+\s*=\s*\d+|\"\s*(or|and)\s+\d+\s*=\s*\d+)",
    re.IGNORECASE,
)
XSS_REGEX = re.compile(r"(<script|javascript:|onload|onerror|onclick|alert\(|<img\s+src)", re.IGNORECASE)
PATH_TRAVERSAL_REGEX = re.compile(r"(\.\./|\.\.\\|etc/passwd|boot\.ini|win\.ini)", re.IGNORECASE)


class PulseMonitor:
    def __init__(
        self,
        service_name: str = "FastAPI Service",
        dashboard_endpoint: str = "/pulse",
        max_buffer_size: int = 1000,
        enable_threat_detection: bool = True,
        open_api_spec_url: str = "/openapi.json",
        auth_secret: str = "",
        dashboard_html_path: Optional[str] = None,
    ):
        self.service_name = service_name
        self.dashboard_endpoint = dashboard_endpoint.rstrip("/")
        self.max_buffer_size = max_buffer_size
        self.enable_threat_detection = enable_threat_detection
        self.open_api_spec_url = open_api_spec_url
        self.auth_secret = auth_secret
        self.dashboard_html_path = dashboard_html_path

        self.requests_buffer: deque = deque(maxlen=max_buffer_size)
        self.threats_buffer: deque = deque(maxlen=max_buffer_size)
        self.stream_subscribers: List[Callable[[Dict[str, Any]], None]] = []
        self.start_time = time.time()

    def sanitize_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        sanitized = {}
        for k, v in headers.items():
            if k.lower() in SENSITIVE_HEADERS:
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = v
        return sanitized

    def sanitize_payload(self, body: Any) -> Any:
        if not body:
            return body
        if isinstance(body, str):
            try:
                parsed = json.loads(body)
                return json.dumps(self.sanitize_payload(parsed))
            except Exception:
                return body
        if isinstance(body, list):
            return [self.sanitize_payload(item) for item in body]
        if isinstance(body, dict):
            sanitized = {}
            for k, v in body.items():
                if any(s in k.lower() for s in SENSITIVE_KEYS):
                    sanitized[k] = "[REDACTED]"
                else:
                    sanitized[k] = self.sanitize_payload(v)
            return sanitized
        return body

    def detect_threat(self, path: str, method: str, ip: str, headers: Dict[str, str], query: str, body: Any) -> Optional[Dict[str, Any]]:
        target_str = f"{path} {query} {str(body) if body else ''}"

        if PATH_TRAVERSAL_REGEX.search(target_str):
            return {
                "id": f"thr_{int(time.time() * 1000)}",
                "attackType": "Path Traversal",
                "severity": "CRITICAL",
                "details": f"Suspicious path traversal in {path}",
                "ip": ip,
                "method": method,
                "path": path,
                "timestamp": int(time.time() * 1000),
            }

        if SQLI_REGEX.search(target_str):
            return {
                "id": f"thr_{int(time.time() * 1000)}",
                "attackType": "SQL Injection",
                "severity": "HIGH",
                "details": f"SQL injection signature matched in request",
                "ip": ip,
                "method": method,
                "path": path,
                "timestamp": int(time.time() * 1000),
            }

        if XSS_REGEX.search(target_str):
            return {
                "id": f"thr_{int(time.time() * 1000)}",
                "attackType": "XSS",
                "severity": "HIGH",
                "details": f"Cross-site scripting signature in request",
                "ip": ip,
                "method": method,
                "path": path,
                "timestamp": int(time.time() * 1000),
            }

        return None

    def record_request(
        self,
        method: str,
        path: str,
        status_code: int = 200,
        duration_ms: float = 0.0,
        ip: str = "127.0.0.1",
        user_agent: str = "",
        headers: Optional[Dict[str, str]] = None,
        query: str = "",
        req_body: Optional[str] = None,
        res_body: Optional[str] = None,
    ):
        now_ms = int(time.time() * 1000)

        # 1. Threat check
        if self.enable_threat_detection:
            alert = self.detect_threat(path, method, ip, headers or {}, query, req_body)
            if alert:
                self.threats_buffer.append(alert)
                self.broadcast_event({
                    "id": alert["id"],
                    "type": "threat",
                    "timestamp": now_ms,
                    "threatType": alert["attackType"],
                    "severity": alert["severity"],
                    "targetField": "request",
                    "matchedPattern": alert["details"],
                    "clientIp": ip,
                    "userAgent": user_agent,
                })

        # 2. Record request
        metric = {
            "timestamp": now_ms,
            "path": path,
            "method": method,
            "statusCode": status_code,
            "durationMs": duration_ms,
            "ip": ip,
            "userAgent": user_agent,
            "reqBody": self.sanitize_payload(req_body),
            "resBody": self.sanitize_payload(res_body),
        }
        self.requests_buffer.append(metric)

        # 3. Broadcast SSE
        self.broadcast_event({
            "id": f"req_{now_ms}",
            "type": "request",
            "timestamp": now_ms,
            "request": {
                "method": method,
                "path": path,
                "ip": ip,
                "userAgent": user_agent,
            },
            "response": {
                "statusCode": status_code,
                "durationMs": duration_ms,
            },
        })

    def broadcast_event(self, event: Dict[str, Any]) -> None:
        for sub in list(self.stream_subscribers):
            try:
                sub(event)
            except Exception:
                if sub in self.stream_subscribers:
                    self.stream_subscribers.remove(sub)

    def subscribe_stream(self, subscriber: Callable[[Dict[str, Any]], None]) -> Callable[[], None]:
        self.stream_subscribers.append(subscriber)

        def unsubscribe():
            if subscriber in self.stream_subscribers:
                self.stream_subscribers.remove(subscriber)

        return unsubscribe

    def get_protocol_meta(self) -> Dict[str, Any]:
        return {
            "protocolVersion": "0.1.0",
            "runtime": {
                "language": "python",
                "framework": "fastapi",
                "version": sys.version.split()[0],
            },
            "serviceName": self.service_name,
            "bufferSize": self.max_buffer_size,
            "features": {
                "threatDetection": self.enable_threat_detection,
                "openApiDrift": bool(self.open_api_spec_url),
                "payloadInspection": True,
            },
            "openApiSpecUrl": self.open_api_spec_url or None,
        }

    def get_canonical_events(self, limit: int = 100, since: int = 0, event_type: str = "all") -> List[Dict[str, Any]]:
        events = []
        if event_type in ("all", "request"):
            for r in self.requests_buffer:
                if r["timestamp"] >= since:
                    events.append({
                        "id": f"req_{r['timestamp']}",
                        "type": "request",
                        "timestamp": r["timestamp"],
                        "request": {
                            "method": r["method"],
                            "path": r["path"],
                            "ip": r["ip"],
                            "userAgent": r["userAgent"],
                        },
                        "response": {
                            "statusCode": r["statusCode"],
                            "durationMs": r["durationMs"],
                        },
                    })

        if event_type in ("all", "threat"):
            for t in self.threats_buffer:
                if t["timestamp"] >= since:
                    events.append({
                        "id": t["id"],
                        "type": "threat",
                        "timestamp": t["timestamp"],
                        "threatType": t["attackType"],
                        "severity": t["severity"],
                        "targetField": "request",
                        "matchedPattern": t["details"],
                        "clientIp": t["ip"],
                    })

        events.sort(key=lambda x: x["timestamp"], reverse=True)
        return events[:limit]

    def get_dashboard_data(self) -> Dict[str, Any]:
        return {
            "system": {
                "memory": {"rss": 42.5, "heapUsed": 24.1, "heapTotal": 64.0, "systemTotal": 8192, "systemFree": 4096},
                "uptime": int(time.time() - self.start_time),
                "cpuUsage": {"user": 12000, "system": 5000},
                "cpuCount": os.cpu_count() or 4,
                "loadAvg": [0.15, 0.22, 0.18],
                "nodeVersion": f"Python {sys.version.split()[0]}",
                "platform": sys.platform,
                "pid": os.getpid(),
                "eventLoopLag": 0.5,
            },
            "requests": list(self.requests_buffer),
            "threats": list(self.threats_buffer),
            "discoveredRoutes": [],
            "config": {
                "enableThreatDetection": self.enable_threat_detection,
                "maxBufferSize": self.max_buffer_size,
                "isServerless": False,
                "dashboardEndpoint": self.dashboard_endpoint,
                "hasAuth": bool(self.auth_secret),
                "logBodies": True,
                "serviceName": self.service_name,
                "openApiSpecUrl": self.open_api_spec_url,
            },
        }

    def get_dashboard_html(self) -> str:
        candidates = [
            self.dashboard_html_path,
            os.path.join(os.getcwd(), "dist", "ui", "index.html"),
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "dist", "ui", "index.html"),
        ]

        raw_html = None
        for path in candidates:
            if path and os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    raw_html = f.read()
                    break

        if not raw_html:
            raw_html = """<!DOCTYPE html><html><head><title>Pulse Monitor</title></head><body style="background:#0b0f19;color:#fff;font-family:sans-serif;text-align:center;padding:5rem;"><h2>⚡ Pulse Monitor UI</h2><p>Python Adapter is active. Build UI to embed frontend dashboard.</p></body></html>"""

        config_script = f"""<script>window.__PULSE_CONFIG__ = {json.dumps({
            "apiPrefix": f"{self.dashboard_endpoint}/api",
            "streamPrefix": f"{self.dashboard_endpoint}/api/stream",
            "openApiUrl": self.open_api_spec_url or None,
            "serviceName": self.service_name,
        })};</script>"""

        if "</head>" in raw_html:
            return raw_html.replace("</head>", f"{config_script}</head>")
        return f"{config_script}{raw_html}"
