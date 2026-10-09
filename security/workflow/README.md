# PipelineGuard — Workflow Security

GitHub Actions workflow analyzer (Member 1).

## Layout

- `parser.py` — YAML → models (`yaml.SafeLoader` only; `on:` is kept as the string key `"on"`)
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
pip install -r security/workflow/requirements.txt
python -m pytest -v
```

Requires Python 3.11+.
