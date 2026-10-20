#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo " PipelineGuard Quality Gate: Member 1 Workflow Security   "
echo "=========================================================="

echo -e "\n[1/5] Running Ruff Linter..."
ruff check security

echo -e "\n[2/5] Running Mypy Strict Type Checking..."
python -m mypy --strict security

echo -e "\n[3/5] Running Bandit Security Audit..."
bandit -r security -x security/workflow/tests

echo -e "\n[4/5] Running Pip-Audit Supply Chain Vulnerability Scan..."
pip-audit -r security/workflow/requirements.txt --disable-pip --no-deps

echo -e "\n[5/5] Running Pytest Suite with Coverage Gate (>=90%)..."
python -m pytest security/workflow/tests/ -v

echo "=========================================================="
echo " ALL QUALITY GATES PASSED CLEANLY!                        "
echo "=========================================================="
