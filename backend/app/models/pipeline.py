from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    repository = Column(String(500), nullable=True)
    branch = Column(String(255), nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
