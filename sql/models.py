from sqlalchemy import Column, Integer, Text
from sql.database import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    rating = Column(Integer, nullable=False)   # 1–5
    comment = Column(Text, nullable=True)