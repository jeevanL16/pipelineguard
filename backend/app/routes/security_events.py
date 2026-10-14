from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.security_event import SecurityEvent
from app.schemas.security_event import (
    SecurityEventCreate,
    SecurityEventResponse,
)

router = APIRouter(prefix="/api/events", tags=["Security Events"])


@router.get("", response_model=list[SecurityEventResponse])
def list_events(db: Session = Depends(get_db)):
    return (
        db.query(SecurityEvent)
        .order_by(SecurityEvent.id.desc())
        .all()
    )


@router.post(
    "",
    response_model=SecurityEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    event_data: SecurityEventCreate,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.event_id == event_data.event_id)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An event with this event_id already exists",
        )

    event = SecurityEvent(**event_data.model_dump())
    db.add(event)

    try:
        db.commit()
        db.refresh(event)
    except Exception:
        db.rollback()
        raise

    return event
