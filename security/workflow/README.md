# PipelineGuard — Workflow Security

GitHub Actions workflow analyzer (Member 1). This phase is package layout and importable skeletons only.

## Layout

- `parser.py` — YAML → models (not implemented yet)
- `analyzer.py` — run detectors (not implemented yet)
- `detectors/` — injection, commands, permissions, network, modification (not implemented yet)
- `rules.py` — rule IDs and severity/action policy
- `events.py` — findings → common PipelineGuard event dicts
- `reporter.py` — terminal/JSON output and exit codes
- `labs/` — inert example workflows (added in a later phase)
- `tests/` — pytest

## Tests

From the repository root:

```bash
pip install pytest
python -m pytest -v
```

Requires Python 3.11+.
