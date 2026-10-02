"""
Pulse Monitor - FastAPI / Starlette ASGI Middleware
"""

import time
import json
import asyncio
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, HTMLResponse, JSONResponse, StreamingResponse

from .monitor import PulseMonitor


class PulseMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        monitor: Optional[PulseMonitor] = None,
        endpoint: str = "/pulse",
        service_name: str = "FastAPI Service",
        auth_secret: str = "",
        open_api_spec_url: str = "/openapi.json",
    ):
        super().__init__(app)
        self.monitor = monitor or PulseMonitor(
            service_name=service_name,
            dashboard_endpoint=endpoint,
            auth_secret=auth_secret,
            open_api_spec_url=open_api_spec_url,
        )
        self.endpoint = endpoint.rstrip("/")

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        is_dashboard_root = path == self.endpoint or path == f"{self.endpoint}/"
        is_dashboard_api = path.startswith(f"{self.endpoint}/")

        if is_dashboard_root or is_dashboard_api:
            # Check Auth if configured
            if self.monitor.auth_secret:
                auth_header = request.headers.get("x-pulse-auth") or request.query_params.get("secret")
                if auth_header != self.monitor.auth_secret:
                    return JSONResponse({"error": "Unauthorized"}, status_code=401)

            # 1. Metadata Endpoint
            if path == f"{self.endpoint}/api/meta":
                return JSONResponse(self.monitor.get_protocol_meta())

            # 2. Events Endpoint
            if path == f"{self.endpoint}/api/events":
                limit = int(request.query_params.get("limit", 100))
                since = int(request.query_params.get("since", 0))
                event_type = request.query_params.get("type", "all")
                return JSONResponse(self.monitor.get_canonical_events(limit, since, event_type))

            # 3. SSE Stream Endpoint
            if path == f"{self.endpoint}/api/stream":
                async def event_generator():
                    queue = asyncio.Queue()

                    def listener(event):
                        queue.put_nowait(event)

                    unsubscribe = self.monitor.subscribe_stream(listener)
                    # Send connected event
                    yield f"data: {json.dumps({'type': 'connected', 'timestamp': int(time.time() * 1000)})}\n\n"

                    try:
                        while True:
                            try:
                                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                                yield f"data: {json.dumps(event)}\n\n"
                            except asyncio.TimeoutError:
                                yield ": ping\n\n"
                    finally:
                        unsubscribe()

                return StreamingResponse(
                    event_generator(),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                    },
                )

            # 4. Legacy /data endpoint
            if path == f"{self.endpoint}/data":
                return JSONResponse(self.monitor.get_dashboard_data())

            # 5. Serve HTML Dashboard
            if is_dashboard_root:
                html = self.monitor.get_dashboard_html()
                return HTMLResponse(html)

        # Monitor regular traffic
        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "127.0.0.1"
        user_agent = request.headers.get("user-agent", "")
        method = request.method

        response: Response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        self.monitor.record_request(
            method=method,
            path=path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
            ip=client_ip,
            user_agent=user_agent,
            query=str(request.query_params),
        )

        return response
