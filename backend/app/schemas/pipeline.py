from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PipelineCreate(BaseModel):
    pipeline_id: str
    name: str
    repository: str | None = None
    branch: str | None = None
    status: str = "ACTIVE"


class PipelineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pipeline_id: str
    name: str
    repository: str | None
    branch: str | None
    status: str
    created_at: datetime | None
