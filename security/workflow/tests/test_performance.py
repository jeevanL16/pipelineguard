"""Performance and scaling benchmark tests (Phase 7 Step 7).

Generates 1,000 realistic workflows in a temporary directory and verifies:
1. Full scan finishes within the stated budget (15.0s based on ~3.5s-6.0s measured baseline).
2. Linear-ish scaling: scanning 1,000 workflows takes < 3.0x the time to scan 500 workflows.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from security.workflow.api import analyze_path

_WORKFLOW_TEMPLATES = [
    # Archetype 1: Standard matrix CI (clean)
    """name: Matrix CI {i}
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  test:
    strategy:
      matrix:
        python-version: ["3.10", "3.11"]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          persist-credentials: false
      - name: Set up Python
        uses: actions/setup-python@0a5c61591373683505ea898e09a6ea1c87f51a66
        with:
          python-version: ${{{{ matrix.python-version }}}}
      - run: python -m pytest tests/
""",
    # Archetype 2: Deployment with safe env (clean)
    """name: Release Deploy {i}
on:
  release:
    types: [published]
permissions:
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        with:
          persist-credentials: false
      - name: Publish artifacts
        env:
          RELEASE_TAG: ${{{{ github.event.release.tag_name }}}}
          AUTH_TOKEN: ${{{{ secrets.DEPLOY_TOKEN }}}}
        run: |
          echo "Deploying release $RELEASE_TAG"
          python -m tools.deploy --tag "$RELEASE_TAG"
""",
    # Archetype 3: Issue triage conditional (clean)
    """name: Issue Triage {i}
on:
  issues:
    types: [opened]
permissions:
  issues: read
jobs:
  triage:
    if: github.event.issue.state == 'open'
    runs-on: ubuntu-latest
    steps:
      - name: Log issue
        env:
          TITLE: ${{{{ github.event.issue.title }}}}
        run: echo "Processing issue: $TITLE"
""",
    # Archetype 4: Container digest execution (clean)
    """name: Docker Job {i}
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  container:
    runs-on: ubuntu-latest
    steps:
      - uses: docker://alpine@sha256:77726ef6b57ddf65bb551896826ec788861777a80057bc7a70a0581b77432096
        with:
          args: echo "Running inside pinned container"
""",
    # Archetype 5: PR review CI with deliberate findings
    """name: PR Verification {i}
on:
  pull_request_target:
    types: [opened]
permissions:
  contents: write
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Echo untrusted title directly
        run: echo "${{{{ github.event.pull_request.title }}}}"
""",
]

_BUDGET_SEC: float = 15.0  # Measured baseline ~3.5s-6.0s + 2.5x margin for slow/virtualized CI
_MAX_SCALING_RATIO: float = 3.0  # 2x input (1000 vs 500) must scale under 3.0x time


@pytest.mark.timeout(45)
def test_thousand_workflow_performance_and_scaling(tmp_path: Path) -> None:
    """Scan 1,000 generated workflows, asserting time budget and linear-ish scaling."""
    dir_500 = tmp_path / "batch_500"
    dir_1000 = tmp_path / "batch_1000"
    dir_500.mkdir()
    dir_1000.mkdir()

    # Pre-generate 500 workflows into batch_500
    for i in range(500):
        tmpl = _WORKFLOW_TEMPLATES[i % len(_WORKFLOW_TEMPLATES)]
        content = tmpl.format(i=i)
        (dir_500 / f"workflow_{i:04d}.yml").write_text(content, encoding="utf-8")

    # Pre-generate 1,000 workflows into batch_1000
    for i in range(1000):
        tmpl = _WORKFLOW_TEMPLATES[i % len(_WORKFLOW_TEMPLATES)]
        content = tmpl.format(i=i)
        (dir_1000 / f"workflow_{i:04d}.yml").write_text(content, encoding="utf-8")

    # Measure 500 workflows
    t0 = time.perf_counter()
    res_500 = analyze_path(dir_500)
    t_500 = time.perf_counter() - t0
    assert res_500.workflows_analyzed == 500

    # Measure 1,000 workflows
    t0 = time.perf_counter()
    res_1000 = analyze_path(dir_1000)
    t_1000 = time.perf_counter() - t0
    assert res_1000.workflows_analyzed == 1000

    throughput_500 = 500 / t_500
    throughput_1000 = 1000 / t_1000
    scaling_ratio = t_1000 / t_500

    print(
        f"\n[PERFORMANCE REPORT]\n"
        f"  500 workflows:   {t_500:.3f}s ({throughput_500:.1f} workflows/s)\n"
        f"  1,000 workflows: {t_1000:.3f}s ({throughput_1000:.1f} workflows/s)\n"
        f"  Scaling ratio:   {scaling_ratio:.2f}x (threshold: <= {_MAX_SCALING_RATIO:.1f}x)\n"
        f"  Findings count:  {len(res_1000.findings)}\n"
        f"  Time budget:     {t_1000:.3f}s <= {_BUDGET_SEC:.1f}s"
    )

    # Assert budget
    assert t_1000 <= _BUDGET_SEC, (
        f"1,000 workflow scan took {t_1000:.3f}s, exceeding budget of {_BUDGET_SEC}s"
    )

    # Assert linear-ish scaling: 2x input is under 3x time
    assert scaling_ratio <= _MAX_SCALING_RATIO, (
        f"Scaling ratio {scaling_ratio:.2f}x exceeds threshold {_MAX_SCALING_RATIO}x"
    )
