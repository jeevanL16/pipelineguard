"""Turn workflow findings into PipelineGuard security events.

The event dict uses the same required keys as Member 2
(event_type, source, severity, repository, file, line, rule, action, status).
"""

# action: WARN is new versus Member 2's always-BLOCK; Member 3 must handle WARN.
