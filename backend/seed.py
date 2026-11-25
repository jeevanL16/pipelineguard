"""Seed SQLite database with realistic initial telemetry."""
import os
import sys

# Ensure backend root is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timezone
from app.database import engine, Base, SessionLocal
from app.models.pipeline import Pipeline
from app.models.pipeline_run import PipelineRun
from app.models.security_event import SecurityEvent
from app.models.audit_log import AuditLog

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(Pipeline).first():
            print("Database already contains data, skipping seed.")
            return

        print("Seeding database...")

        # 1. Pipelines
        p1 = Pipeline(
            pipeline_id="pipe-auth-service",
            name="Authentication Service",
            repository="https://github.com/my-org/auth-service",
            branch="main",
            status="ACTIVE",
        )
        p2 = Pipeline(
            pipeline_id="pipe-payments-api",
            name="Payments API Engine",
            repository="https://github.com/my-org/payments-api",
            branch="production",
            status="ACTIVE",
        )
        p3 = Pipeline(
            pipeline_id="pipe-data-pipeline",
            name="ETL Data Pipeline",
            repository="https://github.com/my-org/data-pipeline",
            branch="main",
            status="ACTIVE",
        )
        p4 = Pipeline(
            pipeline_id="pipe-frontend-app",
            name="Cloud Dashboard UI",
            repository="https://github.com/my-org/frontend-app",
            branch="main",
            status="ACTIVE",
        )
        db.add_all([p1, p2, p3, p4])
        db.commit()

        # 2. Pipeline Runs
        r1 = PipelineRun(
            run_id="run-101",
            pipeline_id=p1.id,
            branch="main",
            status="SUCCESS",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        r2 = PipelineRun(
            run_id="run-102",
            pipeline_id=p2.id,
            branch="production",
            status="FAILED",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        r3 = PipelineRun(
            run_id="run-103",
            pipeline_id=p3.id,
            branch="main",
            status="RUNNING",
            started_at=datetime.now(timezone.utc),
        )
        r4 = PipelineRun(
            run_id="run-104",
            pipeline_id=p4.id,
            branch="main",
            status="SUCCESS",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add_all([r1, r2, r3, r4])
        db.commit()

        # 3. Security Events
        e1 = SecurityEvent(
            event_id="EVT-PG-001",
            pipeline_id=p1.pipeline_id,
            source="workflow",
            event_type="COMMAND_INJECTION",
            severity="CRITICAL",
            risk_score=95,
            status="OPEN",
            description="Untrusted pull request context (${{ github.event.issue.body }}) flows into bash run step without sanitization.",
            timestamp=datetime.now(timezone.utc),
        )
        e2 = SecurityEvent(
            event_id="EVT-PG-002",
            pipeline_id=p2.pipeline_id,
            source="secrets",
            event_type="POTENTIAL_SECRET_EXPOSURE",
            severity="CRITICAL",
            risk_score=92,
            status="INVESTIGATING",
            description="AWS Access Key ID pattern (AKIAIOSFODNN7EXAMPLE) detected in pipeline environment secrets block.",
            timestamp=datetime.now(timezone.utc),
        )
        e3 = SecurityEvent(
            event_id="EVT-PG-003",
            pipeline_id=p3.pipeline_id,
            source="workflow",
            event_type="EXCESSIVE_PERMISSIONS",
            severity="HIGH",
            risk_score=75,
            status="OPEN",
            description="Workflow runs with default GITHUB_TOKEN write-all scope instead of explicit least-privilege permissions.",
            timestamp=datetime.now(timezone.utc),
        )
        e4 = SecurityEvent(
            event_id="EVT-PG-004",
            pipeline_id=p4.pipeline_id,
            source="workflow",
            event_type="SUPPLY_CHAIN_UNPINNED",
            severity="MEDIUM",
            risk_score=55,
            status="RESOLVED",
            description="Third-party action actions/checkout@v3 referenced by mutable tag instead of immutable commit SHA.",
            timestamp=datetime.now(timezone.utc),
        )
        db.add_all([e1, e2, e3, e4])
        db.commit()

        # 4. Audit Log
        a1 = AuditLog(
            event_id=e4.event_id,
            previous_status="OPEN",
            new_status="RESOLVED",
            actor="admin",
        )
        db.add(a1)
        db.commit()

        print("Seeding successfully completed!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
