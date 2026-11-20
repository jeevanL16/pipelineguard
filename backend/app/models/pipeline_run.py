from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)

    run_id = Column(String(100), unique=True, nullable=False, index=True)

    pipeline_id = Column(
        Integer,
        ForeignKey("pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    branch = Column(String(255), nullable=True)
    status = Column(String(50), default="QUEUED", nullable=False)

    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
