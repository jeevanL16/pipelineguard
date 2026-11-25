from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import LocalDashboardRead
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


@router.get("")
def list_audit_logs(
    _local_read: LocalDashboardRead,
    db: Session = Depends(get_db),
):
    records = (
        db.query(AuditLog)
        .order_by(AuditLog.changed_at.desc(), AuditLog.id.desc())
        .limit(200)
        .all()
    )

    return [
        {
            "id": record.id,
            "event_id": record.event_id,
            "previous_status": record.previous_status,
            "new_status": record.new_status,
            "actor": record.actor,
            "changed_at": record.changed_at,
        }
        for record in records
    ]
