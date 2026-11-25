# PipelineGuard

### CI/CD Security & Software Supply-Chain Threat Detection Platform

PipelineGuard is a security platform designed to identify, assess, and report threats across CI/CD pipelines and software build artifacts.

It combines static GitHub Actions workflow analysis, exposed-secret detection, artifact integrity verification, and a centralized security dashboard backed by FastAPI and PostgreSQL.

The goal is to help development teams identify dangerous pipeline configurations, prevent credential exposure, detect artifact tampering, and maintain visibility into security events.

---

## Core Capabilities

| Module | Capabilities |
|---|---|
| Workflow Security | Static analysis of GitHub Actions workflows, script injection detection, permission analysis, suspicious commands, and supply-chain risks |
| Secrets Security | Gitleaks-based detection of exposed API keys, tokens, passwords, and private keys |
| Artifact Security | SHA-256 hashing, trusted hash comparison, and artifact tampering detection |
| Security Backend | FastAPI REST API, PostgreSQL persistence, JWT dashboard authentication, and scanner-token authentication |
| Security Dashboard | React-based dashboard for pipelines, workflow threats, security events, runs, and audit logs |

## Architecture

```text
                 CI/CD REPOSITORY
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
    WORKFLOW         SECRETS       ARTIFACT
    SECURITY         SECURITY      SECURITY
    ANALYZER         GITLEAKS      VERIFIER
          |             |             |
          +-------------+-------------+
                        |
                SECURITY EVENTS
                        |
                        v
                INTEGRATION LAYER
                        |
                 Authenticated API
                        |
                        v
                 FASTAPI BACKEND
                        |
                        v
                   POSTGRESQL
                        |
                        v
                REACT DASHBOARD
                        |
                        v
                SECURITY VISIBILITY
```

## Security Modules

### 1. Workflow Security

A static security analyzer and policy gate for GitHub Actions workflow definitions.

Detection capabilities include:

- Script injection through untrusted GitHub context.
- Excessive or overly broad workflow permissions.
- Dangerous shell commands and download-to-shell patterns.
- Reverse-shell and suspicious network activity.
- Workflow persistence and modification patterns.
- Unpinned third-party actions and supply-chain risks.
- Unsafe checkout credential configurations.
- Workflow parsing and resource-exhaustion protection.

The analyzer includes configurable rules, severity levels, remediation guidance, fingerprint-based deduplication, suppression support, risk scoring, and text, JSON, and SARIF reporting.

**Rule catalog:** PG-WF-001 through PG-WF-023, plus system rules PG-WF-900 and PG-WF-901.

### 2. Secrets Security

Uses [Gitleaks](https://github.com/gitleaks/gitleaks) to scan source code and directories for potentially exposed credentials.

Capabilities include:

- API key and access-token detection.
- Cloud credential and private-key detection.
- Password and generic credential classification.
- PipelineGuard severity mapping.
- Safe finding output without displaying raw secret values.
- Structured security-event generation.

Secret values are not included in generated security events.

### 3. Artifact Security

Verifies build artifact integrity using SHA-256.

Capabilities include:

- Chunked SHA-256 hashing.
- Comparison against trusted expected hashes.
- Verification using a separate hashes file.
- PASS/BLOCK decisions.
- CRITICAL security events when an artifact hash does not match.

Artifact signing and Cosign integration are future enhancements, not current capabilities.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, JavaScript, Recharts, Lucide React |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy |
| Database | PostgreSQL, psycopg2 |
| Authentication | JWT, HTTP Bearer authentication, Argon2 password hashing |
| Workflow Analysis | Python, PyYAML, custom static-analysis detectors |
| Secrets Detection | Gitleaks |
| Artifact Integrity | SHA-256 |
| Testing | pytest, pytest-cov |
| Development Environment | Linux, Git, Node.js, npm |

---

## Project Structure

```text
PipelineGuard/
├── backend/
│   ├── app/
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── routes/
│   │   └── schemas/
│   ├── tests/
│   └── requirements.txt
│
├── dashboard/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── security/
│   ├── workflow/
│   │   ├── detectors/
│   │   ├── schemas/
│   │   ├── tests/
│   │   ├── analyzer.py
│   │   ├── parser.py
│   │   ├── rules.py
│   │   ├── reporter.py
│   │   └── risk.py
│   │
│   ├── secrets/
│   │   ├── tests/
│   │   ├── scanner.py
│   │   ├── events.py
│   │   └── masking.py
│   │
│   ├── artifacts/
│   │   ├── tests/
│   │   ├── artifact_cli.py
│   │   ├── artifact_hashing.py
│   │   ├── artifact_verifier.py
│   │   └── artifact_events.py
│   │
│   └── integration/
│       ├── workflow_to_backend.py
│       └── security_modules_to_backend.py
│
├── docs/
├── scripts/
├── Makefile
├── pyproject.toml
└── README.md
```

---

## Getting Started

### Prerequisites

Install the following:

- Python 3.11 or newer.
- Node.js and npm.
- PostgreSQL.
- Gitleaks.
- Git.

### 1. Clone the repository

```bash
git clone git@github.com:hmvishwasballari-design/PipelineGuard.git
cd PipelineGuard
```

### 2. Configure the backend

Create a virtual environment:

```bash
cd backend

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/pipelineguard

PIPELINEGUARD_JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
PIPELINEGUARD_DASHBOARD_USERNAME=admin
PIPELINEGUARD_DASHBOARD_PASSWORD_HASH=REPLACE_WITH_ARGON2_HASH
PIPELINEGUARD_SCANNER_API_TOKEN=REPLACE_WITH_A_RANDOM_TOKEN_OF_AT_LEAST_32_CHARACTERS
PIPELINEGUARD_JWT_EXPIRY_MINUTES=30
```

Create the PostgreSQL database before starting the backend.

Use securely generated secrets and an Argon2 password hash. Never commit `.env` files or real credentials.

Start the backend:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend:

- API: http://127.0.0.1:8000
- Swagger documentation: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/health

### 3. Start the dashboard

Open another terminal:

```bash
cd dashboard
npm install
npm run dev
```

Dashboard:

http://127.0.0.1:5173

### 4. Run the security scanners

Run commands from the project root.

**Workflow security:**

```bash
python -m security.workflow .github/workflows/
```

**Secrets security:**

```bash
cd security/secrets
python scanner.py
```

**Artifact security:**

```bash
cd security/artifacts

python artifact_cli.py hash PATH_TO_ARTIFACT

python artifact_cli.py verify PATH_TO_ARTIFACT \
  --expected YOUR_TRUSTED_SHA256_HASH
```

Use a trusted hash obtained independently of the artifact being verified.

---

## Backend API

The FastAPI backend exposes the following API groups:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Backend health check |
| `/api/test` | GET | Frontend/backend connection test |
| `/api/auth/login` | POST | Dashboard authentication |
| `/api/pipelines` | GET / POST | Pipeline operations |
| `/api/pipelines/{pipeline_id}` | GET | Retrieve a pipeline |
| `/api/runs` | GET / POST | Pipeline run operations |
| `/api/runs/{run_id}` | GET | Retrieve a pipeline run |
| `/api/events` | GET / POST | Security event operations |
| `/api/events/{event_id}/status` | PATCH | Update security event status |
| `/api/audit-logs` | GET | Retrieve audit history |

### Authentication model

- Dashboard authentication uses JWT bearer tokens.
- Scanner event ingestion uses a dedicated bearer token.
- Dashboard read endpoints currently use a loopback-address restriction for local development.
- Event status updates and other write operations remain authenticated.

**Deployment note:** The local-only dashboard read policy is intended for local development. A public deployment requires a properly authenticated and authorized access model, HTTPS, production-grade secret management, and suitable network controls.

---

## Integration

The security modules include integration adapters for submitting findings to the FastAPI backend.

Workflow scan in dry-run mode:

```bash
python security/integration/workflow_to_backend.py \
  .github/workflows/
```

Submit workflow findings:

```bash
python security/integration/workflow_to_backend.py \
  .github/workflows/ --submit
```

Scan for secrets and preview events:

```bash
python security/integration/security_modules_to_backend.py \
  secrets .
```

Submit secrets events:

```bash
python security/integration/security_modules_to_backend.py \
  secrets . --submit
```

Verify an artifact and preview its event:

```bash
python security/integration/security_modules_to_backend.py \
  artifact PATH_TO_ARTIFACT \
  --expected YOUR_TRUSTED_SHA256_HASH
```

Add `--submit` to submit generated events. Configure the scanner bearer token in the environment before submitting.

---

## Testing

PipelineGuard includes automated tests for the security modules and backend.

Latest verified results:

| Test suite | Result |
|---|---:|
| Workflow security | 383 passed |
| Secrets security | 33 passed |
| Artifact security | 70 passed |
| Backend | 2 passed |
| Workflow coverage | 98.59% |

Run the suites:

```bash
# Backend
cd backend
.venv/bin/python -m pytest -q --no-cov

# Workflow
cd ..
python -m pytest -q security/workflow/tests

# Secrets
python -m pytest -q security/secrets/tests --no-cov

# Artifacts
python -m pytest -q security/artifacts/tests --no-cov
```

These are the latest verified local test results, not a claim of a hosted CI run.

---

## Security Considerations

- Never commit API keys, tokens, passwords, private keys, or `.env` files.
- Keep scanner credentials separate from dashboard credentials.
- Use trusted, independently obtained artifact hashes.
- Do not expose the development backend directly to the public internet.
- Review scanner findings before applying automated remediation.
- Treat workflow analysis as a security control, not a guarantee that every attack will be detected.

---

## Roadmap

Potential future improvements:

- GitHub Actions integration for automated workflow scanning.
- Stronger end-to-end event-schema consistency across all scanners.
- Artifact signing and verification with Sigstore Cosign.
- Software Bill of Materials (SBOM) generation.
- Supply-chain provenance and attestation.
- Role-based access control and production authentication.
- Centralized alerting and notification workflows.
- Deployment-ready containerization and CI/CD automation.

---

## Project Information

- **Project:** PipelineGuard
- **Category:** Cybersecurity | DevSecOps | CI/CD Security | Software Supply-Chain Security
**Repository:** [hmvishwasballari-design/PipelineGuard](https://github.com/hmvishwasballari-design/PipelineGuard)

PipelineGuard is an academic and engineering project developed to explore practical security controls for modern CI/CD pipelines and software delivery workflows.

---

*Built with a security-first mindset.*
