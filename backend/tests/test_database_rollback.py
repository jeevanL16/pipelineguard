import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

from app.routes.security_events import create_event
from app.schemas.security_event import SecurityEventCreate


class DatabaseRollbackTests(unittest.TestCase):
    def test_create_event_rolls_back_when_commit_fails(self):
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = None
        db.commit.side_effect = RuntimeError("Simulated database failure")

        event_data = SecurityEventCreate(
            event_id="EVT-ROLLBACK-TEST",
            pipeline_id="PIPE-TEST",
            source="workflow-security",
            event_type="workflow_injection",
            severity="HIGH",
            risk_score=90,
            status="OPEN",
            description="Rollback test",
        )

        with self.assertRaisesRegex(
            RuntimeError, "Simulated database failure"
        ):
            create_event(event_data=event_data, db=db, client={'role': 'scanner'})

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.rollback.assert_called_once()

    def test_create_event_rejects_duplicate_id(self):
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = Mock()

        event_data = SecurityEventCreate(
            event_id="EVT-DUPLICATE-TEST",
            source="workflow-security",
            event_type="workflow_injection",
            severity="HIGH",
            description="Duplicate test",
        )

        with self.assertRaises(HTTPException) as context:
            create_event(event_data=event_data, db=db, client={'role': 'scanner'})

        self.assertEqual(context.exception.status_code, 409)
        db.add.assert_not_called()
        db.commit.assert_not_called()
        db.rollback.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
