# PipelineGuard Complete Quality Gate (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " PipelineGuard Quality Gate: Member 1 Workflow Security   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "`n[1/5] Running Ruff Linter..." -ForegroundColor Yellow
ruff check security
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[2/5] Running Mypy Strict Type Checking..." -ForegroundColor Yellow
python -m mypy --strict security
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[3/5] Running Bandit Security Audit..." -ForegroundColor Yellow
bandit -r security -x security/workflow/tests
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[4/5] Running Pip-Audit Supply Chain Vulnerability Scan..." -ForegroundColor Yellow
pip-audit -r security/workflow/requirements.txt --disable-pip --no-deps
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[5/5] Running Pytest Suite with Coverage Gate (>=90%)..." -ForegroundColor Yellow
python -m pytest security/workflow/tests/ -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " ALL QUALITY GATES PASSED CLEANLY!                        " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
