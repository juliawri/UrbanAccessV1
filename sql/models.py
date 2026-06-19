from sqlalchemy import Column, Integer, Text, Float, String
try:
    from sql.database import Base
except ModuleNotFoundError:
    from database import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    origin_lat = Column(Float, nullable=True)
    origin_lng = Column(Float, nullable=True)
    dest_lat = Column(Float, nullable=True)
    dest_lng = Column(Float, nullable=True)
    disability_type = Column(String, nullable=True)
    route_date = Column(String, nullable=True)
    route_total_min = Column(Integer, nullable=True)
    route_num_transfers = Column(Integer, nullable=True)
    route_modes = Column(String, nullable=True)       # e.g. "WALK → BUS 67 → WALK"
    route_legs_summary = Column(Text, nullable=True)  # one line per leg
    route_walk_waypoints = Column(Text, nullable=True) # "lat,lon;lat,lon;..."
    route_transit_stops = Column(Text, nullable=True)  # "name|lat|lon|mode;..."
    recommendation = Column(Text, nullable=True)
    user_id = Column(String, nullable=True)
    user_email = Column(String, nullable=True)

