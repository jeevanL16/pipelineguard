from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.pipeline import Pipeline
from app.models.pipeline_run import PipelineRun
from app.schemas.pipeline_run import (
    PipelineRunCreate,
    PipelineRunResponse,
)

router = APIRouter(prefix="/api/runs", tags=["Pipeline Runs"])


@router.get("", response_model=list[PipelineRunResponse])
def list_runs(db: Session = Depends(get_db)):
    return (
        db.query(PipelineRun)
        .order_by(PipelineRun.id.desc())
        .all()
    )


@router.post(
    "",
    response_model=PipelineRunResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_run(
    run_data: PipelineRunCreate,
    db: Session = Depends(get_db),
):
    pipeline = (
        db.query(Pipeline)
        .filter(Pipeline.id == run_data.pipeline_id)
        .first()
    )

    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )

    existing = (
        db.query(PipelineRun)
        .filter(PipelineRun.run_id == run_data.run_id)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A run with this run_id already exists",
        )

    run = PipelineRun(**run_data.model_dump())
    db.add(run)

    try:
        db.commit()
        db.refresh(run)
    except Exception:
        db.rollback()
        raise

    return run


@router.get("/{run_id}", response_model=PipelineRunResponse)
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = (
        db.query(PipelineRun)
        .filter(PipelineRun.run_id == run_id)
        .first()
    )

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline run not found",
        )

    return run
