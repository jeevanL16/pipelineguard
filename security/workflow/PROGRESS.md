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
- [ ] **Step 3: Detector Unit Tests**
  - [x] `security/workflow/tests/test_detector_injection.py`
  - [ ] `security/workflow/tests/test_detector_permissions.py`
  - [ ] `security/workflow/tests/test_detector_commands.py`
  - [ ] `security/workflow/tests/test_detector_network.py`
  - [ ] `security/workflow/tests/test_detector_modification.py`
  - [ ] `security/workflow/tests/test_detector_supply_chain.py`
- [ ] **Step 4: Fix Existing Tests for mypy --strict**
  - [ ] `security/workflow/tests/test_parser.py`
  - [ ] `security/workflow/tests/test_imports.py`
- [ ] **Step 5: Labs Fixtures**
  - [ ] `security/workflow/labs/vulnerable/` (realistic workflows triggering PG-WF-001..023)
  - [ ] `security/workflow/labs/vulnerable/expected.json`
  - [ ] `security/workflow/labs/secure/` (hardened workflows with zero findings)
- [ ] **Step 6: Labs Integration Test**
  - [ ] `security/workflow/tests/test_labs.py`
- [ ] **Step 7: Quality Gate**
  - [ ] `pytest -v --cov=security.workflow --cov-report=term-missing` (all pass, coverage >= 90%)
  - [ ] `ruff check security/workflow` (0 errors)
  - [ ] `mypy --strict -p security.workflow` (0 errors)
  - [ ] `bandit -r security -x security/workflow/tests` (0 issues)

---

## Phase 6: Orchestration, CLI, Reporting & API (Pending Approval)
- [ ] `analyzer.py`
- [ ] Config (`pipelineguard.yml`)
- [ ] Risk scoring (0-100)
- [ ] `events.py` + JSON Schema
- [ ] `reporter.py` (text, JSON, SARIF 2.1.0)
- [ ] CLI (`python -m security.workflow scan`)
- [ ] Public API (`analyze_path`, `analyze_text`)
