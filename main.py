from fastapi import FastAPI, Form, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from run_pipeline import run_pipeline
from app import get_recommendation

from sql.database import SessionLocal
from sql.models import Feedback

app = FastAPI()

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

@app.post("/submit")
def submit_feedback(
    rating: int = Form(...),
    comment: str = Form(""),
    db: Session = Depends(get_db)
):
    feedback = Feedback(rating=rating, comment=comment)
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return {"message": "saved", "id": feedback.id}

@app.get("/feedback")
def get_feedback(db: Session = Depends(get_db)):
    return db.query(Feedback).all()