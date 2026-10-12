from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.pipeline import Pipeline
from app.schemas.pipeline import PipelineCreate, PipelineResponse

router = APIRouter(prefix="/api/pipelines", tags=["Pipelines"])


@router.get("", response_model=list[PipelineResponse])
def list_pipelines(db: Session = Depends(get_db)):
    return db.query(Pipeline).order_by(Pipeline.id.desc()).all()


@router.post(
    "",
    response_model=PipelineResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_pipeline(
    pipeline_data: PipelineCreate,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Pipeline)
        .filter(Pipeline.pipeline_id == pipeline_data.pipeline_id)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pipeline with this pipeline_id already exists",
        )

    pipeline = Pipeline(**pipeline_data.model_dump())
    db.add(pipeline)

    try:
        db.commit()
        db.refresh(pipeline)
    except Exception:
        db.rollback()
        raise

    return pipeline


@router.get("/{pipeline_id}", response_model=PipelineResponse)
def get_pipeline(pipeline_id: str, db: Session = Depends(get_db)):
    pipeline = (
        db.query(Pipeline)
        .filter(Pipeline.pipeline_id == pipeline_id)
        .first()
    )

    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )

    return pipeline
