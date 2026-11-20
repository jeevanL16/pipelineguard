from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        String(100),
        ForeignKey("security_events.event_id"),
        nullable=False,
        index=True,
    )
    previous_status = Column(String(30), nullable=False)
    new_status = Column(String(30), nullable=False)
    actor = Column(String(100), nullable=False, default="system")
    changed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
