"""Phase 2/4: all modules must import cleanly."""

import security.workflow
import security.workflow.analyzer
import security.workflow.events
import security.workflow.finding
import security.workflow.models
import security.workflow.parser
import security.workflow.reporter
import security.workflow.rules
import security.workflow.detectors
import security.workflow.detectors.commands
import security.workflow.detectors.injection
import security.workflow.detectors.modification
import security.workflow.detectors.network
import security.workflow.detectors.permissions


def test_namespace_package_has_no_security_init():
    """`security/` stays a namespace package so Member 2's tree can merge cleanly."""
    import security
    import pathlib

    security_dir = pathlib.Path(security.__file__).parent if getattr(security, "__file__", None) else None
    # Namespace packages typically have __file__ is None.
    assert getattr(security, "__file__", None) is None
    assert security_dir is None


def test_workflow_package_imports():
    assert security.workflow.__doc__


def test_core_modules_import():
    assert security.workflow.parser.__doc__
    assert security.workflow.analyzer.__doc__
    assert security.workflow.models.__doc__
    assert security.workflow.rules.__doc__
    assert security.workflow.events.__doc__
    assert security.workflow.reporter.__doc__
    assert security.workflow.finding.__doc__


def test_detector_modules_import():
    assert security.workflow.detectors.injection.__doc__
    assert security.workflow.detectors.commands.__doc__
    assert security.workflow.detectors.permissions.__doc__
    assert security.workflow.detectors.network.__doc__
    assert security.workflow.detectors.modification.__doc__
