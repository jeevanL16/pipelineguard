"""Authentication utilities for PipelineGuard API."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
import ipaddress

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash

from app.config import get_settings

ALGORITHM = "HS256"
password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required or credentials are invalid",
        headers={"WWW-Authenticate": "Bearer"},
    )


def hash_password(password: str) -> str:
    """Generate an Argon2 password hash for initial setup."""
    return password_hasher.hash(password)


def authenticate_dashboard_user(username: str, password: str) -> bool:
    """Verify dashboard credentials against environment configuration."""
    settings = get_settings()

    username_ok = secrets.compare_digest(
        username, settings.dashboard_username or "__invalid_username__"
    )

    try:
        password_ok = password_hasher.verify(
            password, settings.dashboard_password_hash
        )
    except (ValueError, TypeError):
        password_ok = False

    return username_ok and password_ok


def create_access_token(username: str) -> str:
    """Create a short-lived signed token for an authenticated dashboard user."""
    settings = get_settings()
    now = datetime.now(timezone.utc)

    payload = {
        "sub": username,
        "role": "dashboard",
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expiry_minutes),
    }

    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def require_dashboard_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> dict:
    """Require a valid dashboard-user access token."""
    if credentials is None:
        raise unauthorized()

    settings = get_settings()

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp", "iat", "role"]},
        )
    except jwt.InvalidTokenError:
        raise unauthorized() from None

    if (
        payload.get("role") != "dashboard"
        or payload.get("sub") != settings.dashboard_username
    ):
        raise unauthorized()

    return {"username": payload["sub"], "role": "dashboard"}


def require_scanner_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> dict:
    """Require the separate scanner integration token."""
    if credentials is None:
        raise unauthorized()

    expected = get_settings().scanner_api_token

    if not expected or not secrets.compare_digest(
        credentials.credentials, expected
    ):
        raise unauthorized()

    return {"role": "scanner"}


def require_local_dashboard_read(request: Request) -> None:
    """Allow read-only dashboard access from this machine only."""
    if request.client is None:
        raise HTTPException(status_code=403, detail="Local access only")

    try:
        address = ipaddress.ip_address(request.client.host)
    except ValueError:
        raise HTTPException(status_code=403, detail="Local access only") from None

    if not address.is_loopback:
        raise HTTPException(status_code=403, detail="Local access only")


DashboardUser = Annotated[dict, Depends(require_dashboard_user)]
LocalDashboardRead = Annotated[None, Depends(require_local_dashboard_read)]
ScannerClient = Annotated[dict, Depends(require_scanner_token)]
