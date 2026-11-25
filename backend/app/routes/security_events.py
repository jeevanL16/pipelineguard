from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.auth import DashboardUser, ScannerClient, LocalDashboardRead
from app.models.security_event import SecurityEvent
from app.models.audit_log import AuditLog
from app.schemas.security_event import (
    SecurityEventCreate,
    SecurityEventResponse,
)

router = APIRouter(prefix="/api/events", tags=["Security Events"])


@router.get("", response_model=list[SecurityEventResponse])
def list_events(
    _local_read: LocalDashboardRead,
    db: Session = Depends(get_db),
):
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
    client: ScannerClient,
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



class SecurityEventStatusUpdate(BaseModel):
    status: str


@router.patch("/{event_id}/status", response_model=SecurityEventResponse)
def update_event_status(
    event_id: str,
    status_data: SecurityEventStatusUpdate,
    user: DashboardUser,
    db: Session = Depends(get_db),
):
    allowed_statuses = {
        "OPEN",
        "INVESTIGATING",
        "RESOLVED",
        "FALSE_POSITIVE",
    }

    new_status = status_data.status
    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Invalid status",
                "allowed_statuses": sorted(allowed_statuses),
            },
        )

    event = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.event_id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security event not found",
        )

    previous_status = event.status

    if previous_status == new_status:
        return event

    event.status = new_status

    audit_log = AuditLog(
        event_id=event.event_id,
        previous_status=previous_status,
        new_status=new_status,
        actor=user["username"],
    )
    db.add(audit_log)

    try:
        db.commit()
        db.refresh(event)
    except Exception:
        db.rollback()
        raise

    return event
