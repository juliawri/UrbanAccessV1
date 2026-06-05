from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from run_pipeline import run_pipeline
from app import get_recommendation

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


# -------------------------
# ROUTES AFTER MODELS
# -------------------------
@app.get("/")
def index():
    return FileResponse("index.html")


@app.post("/process")
def process(req: Request):

    routes = run_pipeline(
        req.source.lat,
        req.source.lng,
        req.destination.lat,
        req.destination.lng
    )

    result = get_recommendation(
        origin=(req.source.lat, req.source.lng),
        destination=(req.destination.lat, req.destination.lng),
        disability_type=req.disability_type,
        date=req.date
    )

    return {
        "routes": routes,
        "result": result
    }