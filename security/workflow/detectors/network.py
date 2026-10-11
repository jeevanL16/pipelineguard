"""Network-related security detector for GitHub Actions workflows.

Detects suspicious network activity patterns inside ``run:`` steps.
All regexes use bounded quantifiers to prevent ReDoS.

Rules fired:

* **PG-WF-012** — download from raw IP address
* **PG-WF-013** — known data-exfiltration or C2 service
* **PG-WF-014** — plain HTTP (non-TLS) download
* **PG-WF-015** — ``curl -k`` / ``--insecure`` (TLS verification disabled)
"""

from __future__ import annotations

import re
from typing import Final

from security.workflow.detectors._base import make_finding
from security.workflow.finding import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, Finding
from security.workflow.models import Job, ParseResult, Step

# ---------------------------------------------------------------------------
# Compiled regexes
# ---------------------------------------------------------------------------

# PG-WF-012: raw IPv4 address in a URL.
# Each octet: \d{1,3}  — bounded, no catastrophic backtracking.
_RAW_IP_URL_RE: Final[re.Pattern[str]] = re.compile(
    r"https?://(?:\d{1,3}\.){3}\d{1,3}(?:[:/][^\s\"']{0,200})?",
    re.IGNORECASE,
)

# PG-WF-013: known exfiltration / C2 domains.
# Single alternation of literals — safe from ReDoS.
_EXFIL_DOMAIN_RE: Final[re.Pattern[str]] = re.compile(
    r"(?:^|[\s\"'/])(?:https?://)?(?:"
    r"pastebin\.com"
    r"|paste\.ee"
    r"|hastebin\.com"
    r"|transfer\.sh"
    r"|file\.io"
    r"|temp\.sh"
    r"|0x0\.st"
    r"|ngrok\.io"
    r"|ngrok-free\.app"
    r"|webhook\.site"
    r"|pipedream\.net"
    r"|requestbin\.(?:com|net)"
    r"|canarytokens\.com"
    r"|discord(?:app)?\.com/api/webhooks"
    r"|hooks\.slack\.com/services"
    r"|oast\.(?:me|pro|fun|live|site|online)"
    r"|interactsh\.com"
    r")/[^\s\"']{0,200}",
    re.IGNORECASE,
)
# Also match bare domain (without path) for exfil services.
_EXFIL_BARE_DOMAIN_RE: Final[re.Pattern[str]] = re.compile(
    r"(?:^|[\s\"'/])(?:https?://)?(?:"
    r"transfer\.sh"
    r"|ngrok\.io"
    r"|ngrok-free\.app"
    r"|webhook\.site"
    r"|oast\.(?:me|pro|fun|live|site|online)"
    r"|interactsh\.com"
    r")(?:\s|$|[\"'])",
    re.IGNORECASE,
)

# PG-WF-014: http:// download (not localhost / 127.x).
# [^\s"']{1,200} bounds path length.
_HTTP_DOWNLOAD_RE: Final[re.Pattern[str]] = re.compile(
    r"\bhttp://(?!(?:localhost|127\.0\.0\.1|::1)(?:[:/]|$))"
    r"[A-Za-z0-9][^\s\"']{1,200}",
    re.IGNORECASE,
)

# PG-WF-015: curl with TLS verification disabled.
_CURL_INSECURE_RE: Final[re.Pattern[str]] = re.compile(
    r"\bcurl\b[^\n]{0,300}(?:\s-k\b|\s--insecure\b)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _find_raw_ip(run: str) -> str | None:
    """Return the first raw-IP URL match in *run*, or None."""
    m = _RAW_IP_URL_RE.search(run)
    return m.group(0)[:200] if m else None


def _find_exfil_domain(run: str) -> str | None:
    """Return the first exfil-domain match in *run*, or None."""
    m = _EXFIL_DOMAIN_RE.search(run) or _EXFIL_BARE_DOMAIN_RE.search(run)
    return m.group(0).strip()[:200] if m else None


def _find_http_download(run: str) -> str | None:
    """Return the first plain-HTTP URL in *run*, or None."""
    m = _HTTP_DOWNLOAD_RE.search(run)
    return m.group(0)[:200] if m else None


def _find_curl_insecure(run: str) -> str | None:
    """Return the first curl-insecure match in *run*, or None."""
    m = _CURL_INSECURE_RE.search(run)
    return m.group(0)[:200] if m else None


def _emit_finding(
    findings: list[Finding],
    *,
    file: str,
    job: Job,
    step: Step,
    rule_id: str,
    snippet: str,
    msg: str,
    conf: str = CONFIDENCE_HIGH,
) -> None:
    findings.append(
        make_finding(
            rule_id=rule_id,
            file=file,
            line=step.line,
            job_id=job.id,
            step_name=step.name,
            snippet=snippet,
            message=msg,
            confidence=conf,
        )
    )


# ---------------------------------------------------------------------------
# Public detector
# ---------------------------------------------------------------------------


def detect(result: ParseResult) -> list[Finding]:
    """Detect suspicious network activity in a parsed workflow.

    Scans every ``run:`` block for raw IP URLs, known exfil/C2 domains,
    plain HTTP downloads, and TLS-verification bypass flags.

    Args:
        result: The :class:`~security.workflow.models.ParseResult` to scan.

    Returns:
        List of :class:`~security.workflow.finding.Finding` objects.
        Never raises.
    """
    if not result.ok or result.workflow is None:
        return []

    workflow = result.workflow
    file = workflow.path
    findings: list[Finding] = []

    for job in workflow.jobs:
        for step in job.steps:
            if not step.run:
                continue
            run = step.run

            # PG-WF-012
            snip = _find_raw_ip(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-012",
                    snippet=snip,
                    msg=f"Download from raw IP address '{snip}' — bypasses DNS controls.",
                    conf=CONFIDENCE_MEDIUM,
                )

            # PG-WF-013
            snip = _find_exfil_domain(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-013",
                    snippet=snip,
                    msg=f"Known exfiltration or C2 service contacted: '{snip}'.",
                )

            # PG-WF-014
            snip = _find_http_download(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-014",
                    snippet=snip,
                    msg=f"Plain HTTP (non-TLS) download: '{snip}' — vulnerable to MITM.",
                    conf=CONFIDENCE_MEDIUM,
                )

            # PG-WF-015
            snip = _find_curl_insecure(run)
            if snip:
                _emit_finding(
                    findings,
                    file=file,
                    job=job,
                    step=step,
                    rule_id="PG-WF-015",
                    snippet=snip,
                    msg="curl invoked with -k / --insecure — TLS certificate verification disabled.",
                    conf=CONFIDENCE_HIGH,
                )

    return findings
