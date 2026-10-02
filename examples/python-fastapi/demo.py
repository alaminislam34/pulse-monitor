"""
FastAPI Demo with Pulse Monitor Universal Middleware
Run with:
  pip install fastapi uvicorn
  python demo.py
"""

import sys
import os

# Add local Python SDK to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sdk", "python")))

from fastapi import FastAPI
from pulse_monitor import PulseMiddleware

app = FastAPI(
    title="Python FastAPI Demo with Pulse Monitor",
    description="Universal API observability and dashboard in 1 line of Python",
    version="1.0.0",
)

# 1-Line Pulse Monitor Integration (Just like Swagger UI!)
app.add_middleware(
    PulseMiddleware,
    endpoint="/pulse",
    service_name="Python FastAPI Backend",
    open_api_spec_url="/openapi.json",
)


@app.get("/")
def read_root():
    return {"message": "Hello from Python FastAPI! Visit /pulse for real-time telemetry."}


@app.get("/api/v1/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "query": q, "status": "active"}


@app.post("/api/v1/users")
def create_user(user: dict):
    return {"status": "created", "user": user}


if __name__ == "__main__":
    import uvicorn

    print("\n🚀 FastAPI Demo running at: http://localhost:8000")
    print("📊 Pulse Dashboard available at: http://localhost:8000/pulse")
    print("📖 OpenAPI Schema available at: http://localhost:8000/openapi.json\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
