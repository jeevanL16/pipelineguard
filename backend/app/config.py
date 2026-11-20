"""Environment-backed configuration for PipelineGuard authentication."""

import os
from dotenv import load_dotenv

load_dotenv()
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.jwt_secret = os.getenv("PIPELINEGUARD_JWT_SECRET", "")
        self.dashboard_username = os.getenv("PIPELINEGUARD_DASHBOARD_USERNAME", "")
        self.dashboard_password_hash = os.getenv(
            "PIPELINEGUARD_DASHBOARD_PASSWORD_HASH", ""
        )
        self.scanner_api_token = os.getenv("PIPELINEGUARD_SCANNER_API_TOKEN", "")
        self.jwt_expiry_minutes = int(
            os.getenv("PIPELINEGUARD_JWT_EXPIRY_MINUTES", "30")
        )

    def validate_auth(self) -> None:
        missing = []
        if len(self.jwt_secret) < 32:
            missing.append("PIPELINEGUARD_JWT_SECRET (at least 32 characters)")
        if not self.dashboard_username:
            missing.append("PIPELINEGUARD_DASHBOARD_USERNAME")
        if not self.dashboard_password_hash:
            missing.append("PIPELINEGUARD_DASHBOARD_PASSWORD_HASH")
        if len(self.scanner_api_token) < 32:
            missing.append("PIPELINEGUARD_SCANNER_API_TOKEN (at least 32 characters)")
        if missing:
            raise RuntimeError(
                "Missing or insecure PipelineGuard authentication settings: "
                + ", ".join(missing)
            )
        if self.jwt_expiry_minutes < 1 or self.jwt_expiry_minutes > 1440:
            raise RuntimeError(
                "PIPELINEGUARD_JWT_EXPIRY_MINUTES must be between 1 and 1440"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
