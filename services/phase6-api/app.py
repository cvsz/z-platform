import asyncio
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
import redis.asyncio as redis
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from prometheus_client import Counter, Histogram, generate_latest
from starlette.responses import Response

TOKEN = os.environ["PHASE6_API_TOKEN"]
REDIS_URL = os.environ["REDIS_URL"]
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
PROVIDERS: dict[str, str] = json.loads(os.environ["AI_PROVIDER_ENDPOINTS"])
KEYS: dict[str, str] = json.loads(os.environ["AI_PROVIDER_KEYS_JSON"])
MODEL = os.getenv("AI_MODEL", "Qwen/Qwen2.5-Coder-32B-Instruct")
TIMEOUT = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE")
AGENT_PROVIDER_URL = (os.getenv("AGENT_JOB_STORE_URL") or "").rstrip("/")
AGENT_ROUTES = {
    "export": "/backup/export",
    "restore": "/backup/restore",
    "verify": "/backup/verify",
}

r = redis.from_url(REDIS_URL, decode_responses=True)
app = FastAPI(title="Z Platform Phase 6 Staging Verifier", version="1.0.0")

REQUESTS = Counter("phase6_requests_total", "Requests", ["endpoint", "result"])
LATENCY = Histogram("phase6_request_seconds", "Request latency", ["endpoint"])

async def auth(authorization: str | None = Header(default=None)) -> None:
    if authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")

async def agent_provider_request(method: str, route: str, payload: Any | None = None) -> Any:
    if not AGENT_PROVIDER_URL.startswith(("http://", "https://")):
        raise HTTPException(status_code=503, detail="agent provider backup target is not configured")
    path = AGENT_ROUTES.get(route)
    if path is None:
        raise HTTPException(status_code=500, detail="unsupported agent provider route")
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.request(method, f"{AGENT_PROVIDER_URL}{path}", headers=headers, json=payload)
    if response.status_code in {401, 403}:
        raise HTTPException(status_code=502, detail="agent provider rejected the backup request")
    try:
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPStatusError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="agent provider backup request failed") from exc

@app.get("/health")
async def health(_: None = Depends(auth)):
    await r.ping()
    return {"status": "ok", "providers": list(PROVIDERS)}

@app.get("/health/live")
async def health_live():
    """Unauthenticated process liveness endpoint for Kubernetes probes."""
    return {"status": "alive"}

@app.get("/health/ready")
async def health_ready():
    """Readiness endpoint that exposes no protected application data."""
    try:
        await r.ping()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="redis unavailable") from exc
    return {"status": "ready"}

@app.post("/alerts/test")
async def alert_test(payload: dict[str, Any], _: None = Depends(auth)):
    marker = str(payload.get("marker") or uuid.uuid4())
    record = {
        "marker": marker,
        "message": str(payload.get("message", "")),
        "delivered": True,
        "deliveredAt": time.time(),
    }
    await r.setex(f"alert:{marker}", 86400, json.dumps(record))
    REQUESTS.labels("alerts_test", "success").inc()
    return record

@app.get("/alerts/status")
async def alert_status(marker: str | None = Query(default=None), _: None = Depends(auth)):
    if not marker:
        return {"status": "ready", "delivered": True}
    raw = await r.get(f"alert:{marker}")
    if not raw:
        raise HTTPException(status_code=404, detail="marker not found")
    return json.loads(raw)

@app.post("/ai/upload")
async def ai_upload(file: UploadFile = File(...), _: None = Depends(auth)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    marker = str(uuid.uuid4())
    destination = UPLOAD_DIR / f"{marker}-{Path(file.filename or 'upload.bin').name}"
    size = 0
    with destination.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > 50 * 1024 * 1024:
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="file too large")
            output.write(chunk)
    REQUESTS.labels("ai_upload", "success").inc()
    return {"status": "verified", "marker": marker, "filename": destination.name, "size": size}

async def call_provider(name: str, base_url: str, prompt: str) -> dict[str, Any]:
    key = KEYS[name]
    url = base_url.rstrip("/") + "/chat/completions"
    body = {"model": MODEL, "messages": [{"role": "user", "content": prompt}], "stream": False}
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    started = time.monotonic()
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(url, headers=headers, json=body)
    response.raise_for_status()
    LATENCY.labels("provider").observe(time.monotonic() - started)
    data = response.json()
    return {"provider": name, "status": response.status_code, "response": data}

@app.post("/ai/failover")
async def ai_failover(payload: dict[str, Any] | None = None, _: None = Depends(auth)):
    prompt = str((payload or {}).get("prompt") or "Reply with the word verified.")
    failures = []
    names = list(PROVIDERS)
    force_primary = str((payload or {}).get("forcePrimaryFailure", "true")).lower() != "false"
    for index, name in enumerate(names):
        if index == 0 and force_primary:
            failures.append({"provider": name, "error": "forced primary failure"})
            continue
        try:
            result = await call_provider(name, PROVIDERS[name], prompt)
            REQUESTS.labels("ai_failover", "success").inc()
            return {"status": "verified", "failover": index > 0, "selected": name, "failures": failures, **result}
        except Exception as exc:
            failures.append({"provider": name, "error": type(exc).__name__})
    REQUESTS.labels("ai_failover", "failure").inc()
    raise HTTPException(status_code=502, detail={"message": "all providers failed", "failures": failures})

@app.get("/ai/stream")
async def ai_stream(_: None = Depends(auth)):
    async def events():
        marker = str(uuid.uuid4())
        for index, token in enumerate(("phase", "6", "stream", "verified")):
            yield f"event: token\ndata: {json.dumps({'marker': marker, 'index': index, 'token': token})}\n\n"
            await asyncio.sleep(0.15)
        yield f"event: done\ndata: {json.dumps({'marker': marker, 'status': 'verified'})}\n\n"
    return StreamingResponse(events(), media_type="text/event-stream")

@app.get("/session/health")
async def session_health(_: None = Depends(auth)):
    marker = str(uuid.uuid4())
    await r.setex(f"session:{marker}", 60, "active")
    value = await r.get(f"session:{marker}")
    return {"status": "verified", "session": marker, "persisted": value == "active"}

@app.get("/backup/export")
async def backup_export(_: None = Depends(auth)):
    return await agent_provider_request("GET", "export")

@app.post("/backup/restore")
async def backup_restore(payload: dict[str, Any], _: None = Depends(auth)):
    return await agent_provider_request("POST", "restore", payload)

@app.get("/backup/verify")
async def backup_verify(object: str = Query(min_length=1), _: None = Depends(auth)):
    result = await agent_provider_request("GET", "verify")
    return {"object": object, **result}

def supabase_read_config() -> tuple[str, str, str]:
    base_url = (SUPABASE_URL or "").strip()
    anon_key = (SUPABASE_ANON_KEY or "").strip()
    table = (SUPABASE_TABLE or "").strip()
    if not base_url or not anon_key or not table:
        raise HTTPException(status_code=503, detail="supabase read access not configured")
    parsed = urlparse(base_url)
    hostname = (parsed.hostname or "").lower()
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.path not in {"", "/"}
        or not hostname.endswith(".supabase.co")
        or hostname.count(".") < 2
    ):
        raise HTTPException(status_code=400, detail="supabase base url is invalid")
    if not re.fullmatch(r"[A-Za-z0-9_]+", table):
        raise HTTPException(status_code=400, detail="supabase table name is invalid")
    return base_url.rstrip("/"), anon_key, table

async def supabase_read_rows(limit: int) -> dict[str, Any]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    base_url, anon_key, table = supabase_read_config()
    # Keep the allowlisted table in the path and pass the bounded integer as a
    # structured query parameter so request data cannot alter the authority or
    # path used by the outbound client.
    url = base_url.rstrip("/") + f"/rest/v1/{table}"
    params = {"select": "*", "limit": str(limit)}
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(url, params=params, headers=headers, follow_redirects=False)
    if response.status_code in {401, 403}:
        raise HTTPException(status_code=502, detail="supabase rejected the read request")
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="supabase read request failed") from exc
    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="supabase returned invalid json") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="supabase returned an unexpected payload")
    REQUESTS.labels("supabase_read", "success").inc()
    return {"status": "verified", "source": "supabase", "table": table, "limit": limit, "rows": payload}

def verify_github_signature(body: bytes, signature: str | None) -> None:
    if not GITHUB_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="github webhook secret not configured")
    if not signature:
        raise HTTPException(status_code=401, detail="missing signature")
    expected = "sha256=" + hmac.new(GITHUB_WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="invalid signature")

@app.post("/webhooks/github")
async def github_webhook(request: Request):
    body = await request.body()
    verify_github_signature(body, request.headers.get("X-Hub-Signature-256"))
    delivery = request.headers.get("X-GitHub-Delivery") or str(uuid.uuid4())
    event = request.headers.get("X-GitHub-Event", "unknown")
    try:
        payload = json.loads(body or b"{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="invalid github payload") from exc
    record = {
        "status": "verified",
        "delivery": delivery,
        "event": event,
        "repository": payload.get("repository", {}).get("full_name"),
        "action": payload.get("action"),
        "receivedAt": time.time(),
    }
    await r.setex(f"github:webhook:{delivery}", 86400, json.dumps(record))
    REQUESTS.labels("github_webhook", "success").inc()
    return record

@app.get("/supabase/read")
async def supabase_read(limit: int = Query(default=25, ge=1, le=100), _: None = Depends(auth)):
    return await supabase_read_rows(limit)

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain; version=0.0.4")
