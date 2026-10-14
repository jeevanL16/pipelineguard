from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models.pipeline import Pipeline
from app.models.pipeline_run import PipelineRun
from app.models.security_event import SecurityEvent
from app.routes.pipelines import router as pipelines_router
from app.routes.pipeline_runs import router as pipeline_runs_router
from app.routes.security_events import router as security_events_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PipelineGuard API",
    description="Backend API for the PipelineGuard CI/CD security platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipelines_router)
app.include_router(pipeline_runs_router)
app.include_router(security_events_router)


@app.get("/")
def root():
    return {
        "project": "PipelineGuard",
        "status": "running",
        "phase": "Phase 2",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "pipelineguard-api",
    }


@app.get("/api/test")
def test_connection():
    return {
        "message": "React and FastAPI connection successful",
        "backend": "PipelineGuard API",
    }
