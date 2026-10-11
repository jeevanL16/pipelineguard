.PHONY: all test lint typecheck audit pip-audit check clean

all: check

lint:
	ruff check security

typecheck:
	python -m mypy --strict -p security.workflow

audit:
	bandit -r security -x security/workflow/tests

pip-audit:
	pip-audit -r security/workflow/requirements.txt --disable-pip --no-deps

test:
	python -m pytest security/workflow/tests/ -v

check: lint typecheck audit pip-audit test
