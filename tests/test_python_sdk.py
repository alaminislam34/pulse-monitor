import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sdk", "python")))

from pulse_monitor import PulseMonitor

print("🧪 Running Python SDK Unit Tests...")

monitor = PulseMonitor(
    service_name="Python Test Service",
    dashboard_endpoint="/pulse",
    open_api_spec_url="/openapi.json",
)

# 1. Sanitization Test
sanitized_headers = monitor.sanitize_headers({
    "Content-Type": "application/json",
    "Authorization": "Bearer my-secret-token",
    "Cookie": "session=secret123",
})
assert sanitized_headers["Content-Type"] == "application/json"
assert sanitized_headers["Authorization"] == "[REDACTED]"
assert sanitized_headers["Cookie"] == "[REDACTED]"

sanitized_body = monitor.sanitize_payload({
    "username": "alice",
    "password": "supersecretpassword",
    "api_key": "xyz987",
    "details": {"public": True, "token": "secret"},
})
assert sanitized_body["username"] == "alice"
assert sanitized_body["password"] == "[REDACTED]"
assert sanitized_body["api_key"] == "[REDACTED]"
assert sanitized_body["details"]["token"] == "[REDACTED]"
print("  ✅ Python Sanitization tests passed!")

# 2. Threat Detection Test
threat = monitor.detect_threat("/api/v1/users", "GET", "127.0.0.1", {}, "id=1' UNION SELECT username, password FROM users --", None)
assert threat is not None
assert threat["attackType"] == "SQL Injection"

xss_threat = monitor.detect_threat("/<script>alert(1)</script>", "GET", "127.0.0.1", {}, "", None)
assert xss_threat is not None
assert xss_threat["attackType"] == "XSS"
print("  ✅ Python Threat Detection tests passed!")

# 3. Protocol Metadata & Canonical Events Test
meta = monitor.get_protocol_meta()
assert meta["protocolVersion"] == "0.1.0"
assert meta["runtime"]["language"] == "python"
assert meta["serviceName"] == "Python Test Service"

# Record requests
events_stream = []
unsubscribe = monitor.subscribe_stream(lambda ev: events_stream.append(ev))

monitor.record_request("GET", "/api/items", status_code=200, duration_ms=4.5)
assert len(events_stream) >= 1
assert events_stream[0]["type"] == "request"
assert events_stream[0]["request"]["path"] == "/api/items"

unsubscribe()
events = monitor.get_canonical_events()
assert len(events) == 1
assert events[0]["response"]["statusCode"] == 200
print("  ✅ Python Protocol Meta & Canonical Events tests passed!")

# 4. Dashboard HTML Rendering
html = monitor.get_dashboard_html()
assert "window.__PULSE_CONFIG__" in html
assert "/pulse/api" in html
print("  ✅ Python Dashboard HTML & Config Injection tests passed!")

print("\n🎉 All Python SDK Unit Tests completed successfully!")
