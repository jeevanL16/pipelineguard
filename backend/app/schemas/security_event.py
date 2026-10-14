from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SecurityEventCreate(BaseModel):
    event_id: str = Field(min_length=1, max_length=100)
    pipeline_id: str | None = None
    source: str = Field(min_length=1, max_length=100)
    event_type: str = Field(min_length=1, max_length=100)
    severity: str = Field(min_length=1, max_length=20)
    risk_score: int = Field(default=0, ge=0, le=100)
    status: str = Field(default="OPEN", max_length=30)
    description: str = Field(min_length=1)
    timestamp: datetime | None = None


class SecurityEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: str
    pipeline_id: str | None
    source: str
    event_type: str
    severity: str
    risk_score: int
    status: str
    description: str
    timestamp: datetime | None
    created_at: datetime
