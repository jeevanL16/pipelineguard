# Workflow security (Member 1)

This document will describe PipelineGuard’s GitHub Actions workflow analyzer.

Implementation is not in this phase. The module layout lives under `security/workflow/`. See that directory’s README for how the package is organized.

Security events produced later will use the same required JSON keys as Member 2’s secret scanner (`event_type`, `source`, `severity`, `repository`, `file`, `line`, `rule`, `action`, `status`).
