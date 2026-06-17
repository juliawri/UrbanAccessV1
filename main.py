import csv
import html as _html
import io
import json as _json
import unicodedata
import zipfile
from functools import lru_cache
from pathlib import Path
from fastapi import FastAPI, Depends, Query
from fastapi.responses import FileResponse, HTMLResponse

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
        ("route_modes", "VARCHAR(512)"),
        ("route_legs_summary", "TEXT"),
        ("route_walk_waypoints", "TEXT"),
        ("route_transit_stops", "TEXT"),
        ("recommendation", "TEXT"),
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
    route_modes: Optional[str] = None
    route_legs_summary: Optional[str] = None
    route_walk_waypoints: Optional[str] = None
    route_transit_stops: Optional[str] = None
    recommendation: Optional[str] = None

# -------------------------
# ROUTES AFTER MODELS
# -------------------------
@app.get("/")
def index():
    return FileResponse(BASE_DIR / "index.html")


@app.post("/process")
def process(req: Request):
    routes, routes_data = run_pipeline(
        req.source.lat,
        req.source.lng,
        req.destination.lat,
        req.destination.lng,
        date=req.date
    )

    result = get_recommendation(
        origin=(req.source.lat, req.source.lng),
        destination=(req.destination.lat, req.destination.lng),
        disability_type=req.disability_type,
        date=req.date,
        routes_data=routes_data
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
def submit_feedback(payload: FeedbackSubmit, db: Session = Depends(get_db)):
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
        route_modes=payload.route_modes,
        route_legs_summary=payload.route_legs_summary,
        route_walk_waypoints=payload.route_walk_waypoints,
        route_transit_stops=payload.route_transit_stops,
        recommendation=payload.recommendation,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {"message": "saved", "id": feedback.id}


@app.get("/feedback", response_class=HTMLResponse)
def get_feedback(db: Session = Depends(get_db)):
    rows = db.query(Feedback).order_by(Feedback.id.desc()).all()
    rows_html = ""
    for r in rows:
        origin = f"{r.origin_lat:.4f}, {r.origin_lng:.4f}" if r.origin_lat is not None else "—"
        dest = f"{r.dest_lat:.4f}, {r.dest_lng:.4f}" if r.dest_lat is not None else "—"
        duration = f"{r.route_total_min} min" if r.route_total_min is not None else "—"
        transfers = str(r.route_num_transfers) if r.route_num_transfers is not None else "—"
        modes = _html.escape(r.route_modes or "—")
        rec_text = _html.escape(r.recommendation or "—")
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
          <td>{modes}</td>
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
        <th>Duration</th><th>Transfers</th><th>Modes</th>
        <th>Recommendation</th>
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

