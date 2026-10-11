# PipelineGuard Workflow Security (Member 1) Progress

## Phase 5: Detectors, Tests & Labs

- [x] **Step 0: Safety & Base Models**
  - [x] `security/workflow/models.py` (`Step.with_inputs`, `Job.secrets`)
  - [x] `security/workflow/parser.py` (extract `with`, `secrets`)
  - [x] `security/workflow/rules.py` (Rule `PG-WF-023`)
  - [x] `security/workflow/detectors/_base.py` (`make_finding`, `trigger_set`)
  - [x] `security/workflow/PROGRESS.md` created
- [x] **Step 1: Lint & Type Fixes in Existing Detectors**
  - [x] `security/workflow/detectors/injection.py` (import sorting)
  - [x] `security/workflow/detectors/permissions.py` (import sorting)
  - [x] `security/workflow/detectors/commands.py` (remove loop-variable closure B023, typed helper, fix mypy)
  - [x] `security/workflow/detectors/network.py` (remove loop-variable closure B023, import sorting, fix mypy)
  - [x] `security/workflow/detectors/modification.py` (import sorting)
- [x] **Step 2: Supply Chain Detector**
  - [x] `security/workflow/detectors/supply_chain.py` (PG-WF-019 unpinned actions, PG-WF-020 persist-credentials)
- [x] **Step 3: Detector Unit Tests**
  - [x] `security/workflow/tests/test_detector_injection.py`
  - [x] `security/workflow/tests/test_detector_permissions.py`
  - [x] `security/workflow/tests/test_detector_commands.py`
  - [x] `security/workflow/tests/test_detector_network.py`
  - [x] `security/workflow/tests/test_detector_modification.py`
  - [x] `security/workflow/tests/test_detector_supply_chain.py`
- [x] **Step 4: Fix Existing Tests for mypy --strict**
  - [x] `security/workflow/tests/test_parser.py`
  - [x] `security/workflow/tests/test_imports.py`
- [x] **Step 5: Labs Fixtures**
  - [x] `security/workflow/labs/vulnerable/` (realistic workflows triggering PG-WF-001..023)
  - [x] `security/workflow/labs/vulnerable/expected.json`
  - [x] `security/workflow/labs/secure/` (hardened workflows with zero findings)
- [x] **Step 6: Labs Integration Test**
  - [x] `security/workflow/tests/test_labs.py`
- [x] **Step 7: Quality Gate**
  - [x] `pytest -v --cov=security.workflow --cov-report=term-missing` (all pass, coverage >= 90%)
  - [x] `ruff check security/workflow` (0 errors)
  - [x] `mypy --strict -p security.workflow` (0 errors)
  - [x] `bandit -r security -x security/workflow/tests` (0 issues)

---

## Phase 6: Orchestration, CLI, Reporting & API
- [x] **Step 1: Reserved Rules & Analyzer**
  - [x] Add `PG-WF-900` (parse error / limits exceeded) and `PG-WF-901` (detector error) to `rules.py`
  - [x] Implement `analyzer.py` (`AnalysisResult`, exception isolation, suppression parsing with mandatory reason, dedupe, safe path scanning)
  - [x] Tests in `tests/test_analyzer.py`
- [x] **Step 2: Configuration (`config.py`)**
  - [x] Implement strict `config.py` (overrides, allowlists, fail_on, excludes, defaults, exit code 3 on error)
  - [x] Tests in `tests/test_config.py`
- [x] **Step 3: Risk Scoring (`risk.py`)**
  - [x] Implement pure deterministic risk scoring formula (0-100 score + grade A-F)
  - [x] Tests in `tests/test_risk.py`
- [x] **Step 4: Events & Schema (`events.py`)**
  - [x] Event serialization adhering to common PipelineGuard event schema
  - [x] JSON Schema `security/workflow/schemas/pipelineguard-event.schema.json`
  - [x] Tests in `tests/test_events.py`
- [x] **Step 5: Reporter (`reporter.py`)**
  - [x] Formats: text (sanitized), json (stable keys), sarif (2.1.0)
  - [x] Exit code determination (0 clean, 1 block, 2 warn-only, 3 error)
  - [x] Tests in `tests/test_reporter.py`
- [x] **Step 6: CLI (`__main__.py`)**
  - [x] Argument parsing (`scan <paths>`, `--format`, `--config`, `--fail-on`, `--output`, `--baseline`, `--repository`)
  - [x] Baseline matching and generation
  - [x] Tests in `tests/test_cli.py`
- [x] **Step 7: Public API (`api.py` & `__init__.py`)**
  - [x] Typed `analyze_path()`, `analyze_text()`, `to_events()`
  - [x] Re-export public surface in `security/workflow/__init__.py`
  - [x] Tests in `tests/test_api.py`
- [x] **Step 8: End-to-End & Quality Gate**
  - [x] Tests in `tests/test_e2e.py`
  - [x] All linters, types, tests, and coverage passing (pytest 96%, ruff clean, mypy --strict clean, bandit clean)

---

## Phase 7: Hardening, Fuzzing, Regression & Quality Gates

- [x] **Step 0: Verification of Phase 6 & Initial Fixes**
- [x] **Step 1: Coverage Gate Enforced (`--cov-fail-under=90`, all modules >= 90%)**
  - [x] Enforced `fail_under = 90` in `.coveragerc` and `addopts` in `pytest.ini`
  - [x] Coverage edge cases tested in `tests/test_coverage_gap.py` (98% overall, every module >= 94%)
- [ ] **Step 2: Hostile-Input Test Suite (`tests/test_hostile_inputs.py`)**
- [ ] **Step 3: Fuzzing Suite (`tests/test_fuzz.py` with Hypothesis)**
- [ ] **Step 4: ReDoS Audit (`tests/test_redos.py`)**
- [ ] **Step 5: False-Positive / False-Negative Regression Corpus (`labs/benign/`, `labs/evasion/`)**
- [ ] **Step 6: Detection Gap Review (Composite actions, workflow_call, env, github-script, reusable uses, docs/limitations.md)**
- [ ] **Step 7: Performance Benchmarks (`tests/test_performance.py`)**
- [ ] **Step 8: Self-CI + Dogfood Workflow (`.github/workflows/pipelineguard-ci.yml`)**
- [ ] **Step 9: Tooling and Supply Chain (`requirements.txt`, `requirements-dev.txt`, scripts, .pre-commit-config.yaml, pip-audit)**
- [ ] **Step 10: Final Quality Gate (Full test & linter run)**

