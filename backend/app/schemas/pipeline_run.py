from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PipelineRunCreate(BaseModel):
    run_id: str
    pipeline_id: int
    branch: str | None = None
    status: str = "QUEUED"
    started_at: datetime | None = None
    completed_at: datetime | None = None


class PipelineRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_id: str
    pipeline_id: int
    branch: str | None
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
