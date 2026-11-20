"""Authentication endpoints for the PipelineGuard dashboard."""

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.auth import authenticate_dashboard_user, create_access_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=1024)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest):
    if not authenticate_dashboard_user(
        credentials.username,
        credentials.password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(credentials.username)

    from app.config import get_settings

    return LoginResponse(
        access_token=token,
        expires_in=get_settings().jwt_expiry_minutes * 60,
    )
