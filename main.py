import sys
sys.stdout.reconfigure(line_buffering=True)

# ─── Stdout capture for /api/logs SSE (file-based, multi-worker safe) ────────
import threading as _th
import asyncio as _aio
import os as _os
from pathlib import Path as _Path

_LOG_FILE = _Path(__file__).parent / "logs" / "app.log"
_LOG_FILE.parent.mkdir(exist_ok=True)

_NOISE = (
    "Started server process", "Waiting for application startup",
    "Application startup complete.", "Uvicorn running on",
    "Shutting down", "Finished server process", "Stopping reloader",
    "WatchFiles detected", "Restarting...", "Will watch for changes",
    "HTTP/1.",
)

def _emit(line: str):
    s = line.strip()
    if not s or any(pat in s for pat in _NOISE):
        return
    try:
        with open(_LOG_FILE, 'a') as f:
            f.write(s + '\n')
    except Exception:
        pass

def _reset_logs():
    try:
        with open(_LOG_FILE, 'w') as f:
            f.write('__RESET__\n')
    except Exception:
        pass

_orig_write = sys.stdout.write
_tl = _th.local()

def _cap_write(s):
    r = _orig_write(s)
    if not hasattr(_tl, 'b'):
        _tl.b = ''
    _tl.b += s if isinstance(s, str) else s.decode('utf-8', 'replace')
    while '\n' in _tl.b:
        ln, _tl.b = _tl.b.split('\n', 1)
        _emit(ln)
    return r

sys.stdout.write = _cap_write
# ─────────────────────────────────────────────────────────────────────────────

from dotenv import load_dotenv
load_dotenv()

import csv
import html as _html
import io
import json as _json
import math
import unicodedata
import zipfile
from functools import lru_cache
from pathlib import Path
import os
from fastapi import FastAPI, Depends, Query, Header, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from jose import jwt
from jose.exceptions import JWTError

BASE_DIR = Path(__file__).parent
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict

from run_pipeline import run_pipeline
from app import get_recommendation

from sql.database import SessionLocal, engine
from sql.models import Feedback
from sqlalchemy import text

app = FastAPI()

_SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
_SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
_SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
_jwks_cache = None

def _load_jwks():
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    if not _SUPABASE_URL:
        print("[auth] SUPABASE_URL env var not set — cannot load JWKS for token verification")
        return None
    import urllib.request as _ur
    try:
        with _ur.urlopen(f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=5) as r:
            _jwks_cache = _json.loads(r.read())
        print(f"[auth] JWKS loaded successfully from Supabase ({len(_jwks_cache.get('keys', []))} signing keys)")
    except Exception as e:
        print(f"[auth] JWKS fetch from Supabase failed — ES256 verification unavailable: {str(e)[:80]}")
    return _jwks_cache

def require_admin(authorization: Optional[str] = Header(default=None)):
    if not _ADMIN_TOKEN or authorization != f"Bearer {_ADMIN_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

def optional_auth(authorization: Optional[str] = Header(default=None)):
    """Extract Supabase user from Bearer token; tries ES256 via JWKS then HS256 via secret."""
    if not authorization or not authorization.startswith("Bearer "):
        print("[auth] No Authorization header in request — treating user as anonymous")
        return None, None
    token = authorization[7:]

    # ES256 path — Supabase projects that use asymmetric keys
    jwks = _load_jwks()
    if jwks:
        try:
            kid = jwt.get_unverified_header(token).get("kid")
            keys = jwks.get("keys", [])
            candidates = [k for k in keys if not kid or k.get("kid") == kid] or keys
            for key_data in candidates:
                try:
                    payload = jwt.decode(token, key_data, algorithms=["ES256"], audience="authenticated")
                    print(f"[auth] JWT verified via ES256 — user sub={payload.get('sub')}")
                    return payload.get("sub"), payload.get("email")
                except JWTError:
                    continue
        except Exception as e:
            print(f"[auth] ES256 verification error: {str(e)[:80]}")

    # HS256 fallback — older Supabase projects that use the JWT secret
    if _SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, _SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            print(f"[auth] JWT verified via HS256 fallback — user sub={payload.get('sub')}")
            return payload.get("sub"), payload.get("email")
        except JWTError as e:
            print(f"[auth] HS256 verification failed: {str(e)[:80]}")

    print("[auth] All JWT verification methods failed — request will be treated as anonymous")
    return None, None

# Local flat-earth projection centred on Montreal.
# Converting degrees → metres makes FAISS L2 distance interpretable directly in metres.
_REF_LAT = 45.5
_REF_LON = -73.7
_LAT_TO_M = 111_000
_LON_TO_M = 111_000 * math.cos(math.radians(_REF_LAT))  # ≈ 78 600 m/deg at this latitude


def _build_geo_vec(origin_lat, origin_lng, dest_lat, dest_lng):
    """
    4-dim float32 vector [origin_x, origin_y, dest_x, dest_y] in approximate metres
    relative to Montreal centre. FAISS L2² between two such vectors equals the squared
    combined geographic displacement across both endpoints.
    """
    import numpy as np
    return np.array([
        (origin_lng - _REF_LON) * _LON_TO_M,
        (origin_lat - _REF_LAT) * _LAT_TO_M,
        (dest_lng   - _REF_LON) * _LON_TO_M,
        (dest_lat   - _REF_LAT) * _LAT_TO_M,
    ], dtype="float32")


def _search_similar_route(
    db: Session,
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    disability_type: str,
    user_id: str,
) -> Optional[tuple]:
    """
    FAISS nearest-neighbour search using a metric geographic vector.
    Only searches the current user's own past feedback.
    Disability type is pre-filtered in SQL (exact match required).
    Distance threshold: each endpoint must be within ~500 m of the stored route
    (combined 4-D L2 ≤ ~707 m, i.e. L2² ≤ 500 000).
    Returns a list of (match_dict, similarity_score) tuples (up to 5, closest first), or None.
    """
    try:
        import faiss
        import numpy as np
    except ImportError:
        print("[faiss] faiss-cpu not installed — skipping similarity search")
        return None

    # 500 m per endpoint → combined L2² threshold = 500² + 500² = 500 000
    THRESHOLD_SQ = 500_000.0   # squared metres
    THRESHOLD_M  = math.sqrt(THRESHOLD_SQ)  # ≈ 707 m, for display / scoring

    total_rows = db.query(Feedback).count()
    rows = db.query(Feedback).filter(
        Feedback.origin_lat.isnot(None),
        Feedback.dest_lat.isnot(None),
        Feedback.disability_type == disability_type,
        Feedback.user_id == user_id,
    ).all()
    print(f"[faiss] {len(rows)} feedback rows with coordinates and matching disability type out of {total_rows} total")
    if not rows:
        return None

    matrix = np.stack([
        _build_geo_vec(r.origin_lat, r.origin_lng, r.dest_lat, r.dest_lng)
        for r in rows
    ])
    index = faiss.IndexFlatL2(4)
    index.add(matrix)

    q = _build_geo_vec(origin_lat, origin_lng, dest_lat, dest_lng).reshape(1, -1)
    k = min(5, len(rows))
    # IndexFlatL2 returns *squared* L2 distances
    sq_distances, indices = index.search(q, k)

    top = [(int(indices[0][i]), float(sq_distances[0][i])) for i in range(k)]
    print(f"[faiss] Top-{k} distances (metres): {[(idx, round(d**0.5)) for idx, d in top]}")

    if top[0][1] > THRESHOLD_SQ:
        print(f"[faiss] No close match — nearest is {top[0][1]**0.5:.0f} m away (threshold ≈ {THRESHOLD_M:.0f} m)")
        return None

    matches = []
    for idx, sq_dist in top:
        if sq_dist > THRESHOLD_SQ:
            break  # results are sorted; no need to continue
        actual_dist = sq_dist ** 0.5
        score = max(0.0, 1.0 - actual_dist / THRESHOLD_M)
        r = rows[idx]
        print(f"[faiss] Match #{len(matches)+1}: row_id={r.id}, dist≈{actual_dist:.0f} m, similarity={score:.4f}")
        matches.append(({
            "rating": r.rating,
            "comment": r.comment,
            "disability_type": r.disability_type,
            "route_total_min": r.route_total_min,
            "route_num_transfers": r.route_num_transfers,
            "route_legs_summary": r.route_legs_summary,
        }, score))

    print(f"[faiss] {len(matches)} match(es) within {THRESHOLD_M:.0f} m threshold")
    return matches


@app.on_event("startup")
def preload_vit():
    try:
        import mae_inference
        mae_inference._get_model()
    except Exception as e:
        print(f"[startup] ViT pre-load skipped: {e}")

@app.on_event("startup")
def migrate_db():
    new_cols = [
        ("origin_lat", "FLOAT"),
        ("origin_lng", "FLOAT"),
        ("dest_lat", "FLOAT"),
        ("dest_lng", "FLOAT"),
        ("disability_type", "VARCHAR"),
        ("route_date", "VARCHAR"),
        ("route_total_min", "INTEGER"),
        ("route_num_transfers", "INTEGER"),
        ("route_embedding", "TEXT"),
        ("route_legs_summary", "TEXT"),
        ("route_walk_waypoints", "TEXT"),
        ("route_transit_stops", "TEXT"),
        ("recommendation", "TEXT"),
        ("user_id", "VARCHAR"),
        ("user_email", "VARCHAR"),
    ]
    with engine.connect() as conn:
        for col, col_type in new_cols:
            conn.execute(text(
                f"ALTER TABLE feedback ADD COLUMN IF NOT EXISTS {col} {col_type}"
            ))
        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _normalize(s: str) -> str:
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii").lower()


@lru_cache(maxsize=1)
def _load_gtfs_stops() -> List[Dict]:
    stops = []
    seen_names = set()
    with zipfile.ZipFile(BASE_DIR / "data" / "gtfs_stm.zip") as z:
        with z.open("stops.txt") as f:
            for row in csv.DictReader(io.TextIOWrapper(f, "utf-8")):
                loc_type = row.get("location_type", "0")
                if loc_type not in ("0", "1"):
                    continue
                name = row["stop_name"].strip()
                name_lower = name.lower()
                if name_lower in seen_names:
                    continue
                seen_names.add(name_lower)
                stops.append({
                    "name": name,
                    "name_norm": _normalize(name),
                    "lat": float(row["stop_lat"]),
                    "lon": float(row["stop_lon"]),
                    "type": "metro_station" if loc_type == "1" else "bus_stop",
                })
    return stops


@app.get("/stops")
def search_stops(q: str = Query(default="", min_length=0)):
    if len(q) < 2:
        return []
    q_norm = _normalize(q)
    matches = [s for s in _load_gtfs_stops() if q_norm in s["name_norm"]]
    matches.sort(key=lambda s: (not s["name_norm"].startswith(q_norm), s["name"]))
    return matches[:20]


# -------------------------
# MODELS FIRST
# -------------------------
class Location(BaseModel):
    lat: float
    lng: float

class Request(BaseModel):
    source: Location
    destination: Location
    disability_type: str
    date: str
    time: str = "08:00am"
    fast_mode: bool = False
    language: str = "en"

class FeedbackSubmit(BaseModel):
    rating: int
    comment: str = ""
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    disability_type: Optional[str] = None
    route_date: Optional[str] = None
    route_total_min: Optional[int] = None
    route_num_transfers: Optional[int] = None
    route_legs_summary: Optional[str] = None
    route_walk_waypoints: Optional[str] = None
    route_transit_stops: Optional[str] = None
    recommendation: Optional[str] = None

# -------------------------
# ROUTES AFTER MODELS
# -------------------------
@app.get("/")
def index():
    # Dev fallback — serves the old index.html when the React build doesn't exist yet.
    # Once you run `cd frontend && npm run build`, this is replaced by the SPA catch-all below.
    react_index = BASE_DIR / "frontend" / "dist" / "index.html"
    if react_index.exists():
        return FileResponse(react_index)
    return FileResponse(BASE_DIR / "index.html")


@app.post("/process")
def process(
    req: Request,
    db: Session = Depends(get_db),
    auth=Depends(optional_auth),
):
    _reset_logs()
    jwt_user_id, _ = auth
    print(f"[process] Incoming route request — user: {'authenticated (id set)' if jwt_user_id else 'anonymous (no JWT)'}")

    routes, routes_data = run_pipeline(
        req.source.lat,
        req.source.lng,
        req.destination.lat,
        req.destination.lng,
        date=req.date,
        time=req.time,
    )

    similar_routes = None
    if not jwt_user_id:
        print("[similarity] Skipping similarity search — no authenticated user; past route feedback will not influence recommendation")
    else:
        print("[similarity] Authenticated user — searching past feedback for similar routes to inform recommendation")
        try:
            matches = _search_similar_route(
                db,
                req.source.lat, req.source.lng,
                req.destination.lat, req.destination.lng,
                req.disability_type,
                jwt_user_id,
            )
            if matches:
                similar_routes = matches
                scores = [f"{s:.4f}" for _, s in matches]
                print(f"[similarity] {len(matches)} similar past route(s) found — similarities: {scores}")
            else:
                print("[similarity] No similar past route found — feedback DB may be empty or no close matches")
        except Exception as _sim_err:
            print(f"[similarity] ERROR during similarity search: {type(_sim_err).__name__} — {str(_sim_err)[:80]}")

    result = get_recommendation(
        origin=(req.source.lat, req.source.lng),
        destination=(req.destination.lat, req.destination.lng),
        disability_type=req.disability_type,
        date=req.date,
        routes_data=routes_data,
        fast_mode=req.fast_mode,
        similar_routes=similar_routes,
        language=req.language,
    )

    ranked_ids = result.get("ranked_ids", list(range(len(routes))))
    sorted_routes = [routes[i] for i in ranked_ids if i < len(routes)]
    seen = set(ranked_ids)
    for i, r in enumerate(routes):
        if i not in seen:
            sorted_routes.append(r)

    return {
        "routes": sorted_routes,
        "result": result["text"]
    }


@app.post("/submit")
def submit_feedback(
    payload: FeedbackSubmit,
    db: Session = Depends(get_db),
    auth=Depends(optional_auth),
):
    jwt_user_id, _ = auth
    feedback = Feedback(
        rating=payload.rating,
        comment=payload.comment,
        origin_lat=payload.origin_lat,
        origin_lng=payload.origin_lng,
        dest_lat=payload.dest_lat,
        dest_lng=payload.dest_lng,
        disability_type=payload.disability_type,
        route_date=payload.route_date,
        route_total_min=payload.route_total_min,
        route_num_transfers=payload.route_num_transfers,
        route_embedding=None,
        route_legs_summary=payload.route_legs_summary,
        route_walk_waypoints=payload.route_walk_waypoints,
        route_transit_stops=payload.route_transit_stops,
        recommendation=payload.recommendation,
        user_id=jwt_user_id,
        user_email=None,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {"message": "saved", "id": feedback.id}


@app.delete("/api/user/account")
def delete_account(
    db: Session = Depends(get_db),
    auth=Depends(optional_auth),
):
    user_id, _ = auth
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Delete all feedback rows belonging to this user
    deleted = db.query(Feedback).filter(Feedback.user_id == user_id).delete()
    db.commit()
    print(f"[delete_account] Removed {deleted} feedback row(s) from database for user {user_id}")

    # Remove the user from Supabase Auth via the Admin API
    if _SUPABASE_URL and _SUPABASE_SERVICE_ROLE_KEY:
        import urllib.request as _ur
        import urllib.error
        req = _ur.Request(
            f"{_SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            method="DELETE",
            headers={
                "Authorization": f"Bearer {_SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": _SUPABASE_SERVICE_ROLE_KEY,
            },
        )
        try:
            with _ur.urlopen(req):
                print(f"[delete_account] Supabase auth record deleted for user {user_id}")
        except urllib.error.HTTPError as e:
            print(f"[delete_account] ERROR: Supabase admin API returned {e.code} {e.reason} while deleting user {user_id}")
            raise HTTPException(status_code=502, detail="Failed to delete account from auth provider")
    else:
        print("[delete_account] SUPABASE_SERVICE_ROLE_KEY not set — skipping auth user deletion")

    return {"message": "Account and all associated data deleted"}


@app.get("/api/logs")
async def stream_logs():
    async def _gen():
        pos = 0
        # Send existing log content
        try:
            with open(_LOG_FILE, 'r') as f:
                for line in f:
                    line = line.rstrip('\n')
                    if line == '__RESET__':
                        yield "data: __RESET__\n\n"
                    elif line:
                        yield f"data: {line}\n\n"
                pos = f.tell()
        except FileNotFoundError:
            pos = 0

        # Tail new lines as they arrive
        try:
            while True:
                try:
                    size = _os.path.getsize(_LOG_FILE)
                    if size < pos:
                        # File was truncated (reset) — start from beginning
                        pos = 0
                    with open(_LOG_FILE, 'r') as f:
                        f.seek(pos)
                        new_content = f.read()
                        pos = f.tell()
                    if new_content:
                        for line in new_content.splitlines():
                            if line == '__RESET__':
                                yield "data: __RESET__\n\n"
                            elif line:
                                yield f"data: {line}\n\n"
                    else:
                        yield ": keepalive\n\n"
                except FileNotFoundError:
                    yield ": keepalive\n\n"
                await _aio.sleep(0.5)
        except (GeneratorExit, _aio.CancelledError):
            pass

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/feedback")
def get_feedback_json(db: Session = Depends(get_db), _=Depends(require_admin)):
    rows = db.query(Feedback).order_by(Feedback.id.desc()).all()
    return [
        {
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "origin_lat": r.origin_lat,
            "origin_lng": r.origin_lng,
            "dest_lat": r.dest_lat,
            "dest_lng": r.dest_lng,
            "disability_type": r.disability_type,
            "route_date": r.route_date,
            "route_total_min": r.route_total_min,
            "route_num_transfers": r.route_num_transfers,
            "route_embedding": r.route_embedding,
            "user_id": r.user_id,
        }
        for r in rows
    ]


@app.get("/feedback", response_class=HTMLResponse)
def get_feedback(db: Session = Depends(get_db)):
    rows = db.query(Feedback).order_by(Feedback.id.desc()).all()
    rows_html = ""
    for r in rows:
        origin = f"{r.origin_lat:.4f}, {r.origin_lng:.4f}" if r.origin_lat is not None else "—"
        dest = f"{r.dest_lat:.4f}, {r.dest_lng:.4f}" if r.dest_lat is not None else "—"
        duration = f"{r.route_total_min} min" if r.route_total_min is not None else "—"
        transfers = str(r.route_num_transfers) if r.route_num_transfers is not None else "—"
        embedding_cell = f'<span title="384-dim route vector">✓ 384-dim</span>' if r.route_embedding else "—"
        rec_text = _html.escape(r.recommendation or "—")
        user_cell = _html.escape(r.user_email or "anonymous")
        rows_html += f"""
        <tr>
          <td>{r.id}</td>
          <td>{"★" * r.rating}{"☆" * (5 - r.rating)}</td>
          <td>{_html.escape(r.comment or "")}</td>
          <td>{origin}</td>
          <td>{dest}</td>
          <td>{r.disability_type or "—"}</td>
          <td>{r.route_date or "—"}</td>
          <td>{duration}</td>
          <td>{transfers}</td>
          <td>{embedding_cell}</td>
          <td>{user_cell}</td>
          <td class="rec-cell">{rec_text}</td>
        </tr>"""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Feedback</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
    th, td {{ border: 1px solid #ddd; padding: 7px 10px; text-align: left; vertical-align: top; }}
    th {{ background: #f0f0f0; white-space: nowrap; }}
    tr:nth-child(even) {{ background: #fafafa; }}
    .rec-cell {{ white-space: pre-wrap; max-width: 420px; font-size: 12px; }}
  </style>
</head>
<body>
  <h2>Feedback ({len(rows)} entries)</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Rating</th><th>Comment</th>
        <th>Origin (lat, lng)</th><th>Destination (lat, lng)</th>
        <th>Mobility Aid</th><th>Date</th>
        <th>Duration</th><th>Transfers</th><th>Route Vector</th>
        <th>User</th><th>Recommendation</th>
      </tr>
    </thead>
    <tbody>{rows_html}</tbody>
  </table>
</body>
</html>"""


LEG_COLORS = {"WALK": "#2196F3", "BUS": "#FF9800", "SUBWAY": "#9C27B0", "TRAM": "#4CAF50"}

@app.get("/feedback/{feedback_id}/route", response_class=HTMLResponse)
def view_route(feedback_id: int, db: Session = Depends(get_db)):
    row = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not row:
        return HTMLResponse("<p>Entry not found.</p>", status_code=404)

    rec_escaped = _html.escape(row.recommendation or "No recommendation stored.")
    legs_escaped = _html.escape(row.route_legs_summary or "No directions stored.")
    origin_lat = row.origin_lat or 45.5017
    origin_lng = row.origin_lng or -73.5673
    dest_lat = row.dest_lat or origin_lat
    dest_lng = row.dest_lng or origin_lng
    origin_str = f"{row.origin_lat:.5f}, {row.origin_lng:.5f}" if row.origin_lat else "—"
    dest_str = f"{row.dest_lat:.5f}, {row.dest_lng:.5f}" if row.dest_lat else "—"

    walk_pts_js = _json.dumps(row.route_walk_waypoints or "")
    transit_stops_js = _json.dumps(row.route_transit_stops or "")

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Route — Feedback #{feedback_id}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 16px; }}
    #map {{ height: 420px; width: 100%; margin: 12px 0; }}
    .meta-row {{ font-size: 13px; color: #444; margin-bottom: 4px; }}
    pre {{ white-space: pre-wrap; background: #f4f4f4; padding: 12px; border-radius: 6px; font-size: 13px; }}
  </style>
</head>
<body>
  <h2>Route — Feedback #{feedback_id}</h2>
  <div class="meta-row"><strong>Mobility aid:</strong> {row.disability_type or "—"} &nbsp;|&nbsp; <strong>Date:</strong> {row.route_date or "—"}</div>
  <div class="meta-row"><strong>Origin:</strong> {origin_str} &nbsp;→&nbsp; <strong>Destination:</strong> {dest_str}</div>
  <div class="meta-row"><strong>Duration:</strong> {row.route_total_min or "—"} min &nbsp;|&nbsp; <strong>Transfers:</strong> {row.route_num_transfers if row.route_num_transfers is not None else "—"} &nbsp;|&nbsp; <strong>Modes:</strong> {_html.escape(row.route_modes or "—")}</div>
  <div class="meta-row"><strong>Rating:</strong> {"★" * row.rating}{"☆" * (5 - row.rating)} &nbsp;|&nbsp; <strong>Comment:</strong> {_html.escape(row.comment or "—")}</div>
  <div id="map"></div>
  <h3>Directions</h3>
  <pre>{legs_escaped}</pre>
  <h3>AI Recommendation</h3>
  <pre>{rec_escaped}</pre>
<script>
const LEG_COLORS = {{"WALK":"#2196F3","BUS":"#FF9800","SUBWAY":"#9C27B0","TRAM":"#4CAF50"}};
const map = L.map('map').setView([{origin_lat}, {origin_lng}], 13);
L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{attribution:'© OpenStreetMap'}}).addTo(map);

L.marker([{origin_lat}, {origin_lng}]).addTo(map).bindPopup('Origin');
L.marker([{dest_lat}, {dest_lng}]).addTo(map).bindPopup('Destination');

const layers = [];

// Walk waypoints: "lat,lon;lat,lon;..."
const walkRaw = {walk_pts_js};
if (walkRaw) {{
  const pts = walkRaw.split(';').filter(Boolean).map(p => p.split(',').map(Number));
  if (pts.length > 1) layers.push(L.polyline(pts, {{color:'#2196F3', weight:5, opacity:0.8}}).addTo(map));
}}

// Transit stops: "name|lat|lon|mode;..."
const stopsRaw = {transit_stops_js};
if (stopsRaw) {{
  stopsRaw.split(';').filter(Boolean).forEach(s => {{
    const [name, lat, lon, mode] = s.split('|');
    const color = LEG_COLORS[mode] || '#888';
    const m = L.circleMarker([parseFloat(lat), parseFloat(lon)], {{radius:6, color, fillColor:color, fillOpacity:1, weight:2}}).addTo(map);
    m.bindPopup(`<b>${{mode}}</b><br>${{name}}`);
    layers.push(m);
  }});
}}

if (layers.length > 0) map.fitBounds(L.featureGroup(layers).getBounds().pad(0.1));
</script>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# Production static file serving for the React build
# Run `cd frontend && npm run build` first.
# In development, use the Vite dev server on :5173 instead.
# ─────────────────────────────────────────────────────────────────────────────

_FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    # Serve JS/CSS/images from /assets/
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="static_assets")

    # SPA catch-all — must be the very last route
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        return FileResponse(_FRONTEND_DIST / "index.html")
