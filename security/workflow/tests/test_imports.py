"""Phase 2/4: all modules must import cleanly."""

import security.workflow
import security.workflow.analyzer
import security.workflow.detectors
import security.workflow.detectors.commands
import security.workflow.detectors.injection
import security.workflow.detectors.modification
import security.workflow.detectors.network
import security.workflow.detectors.permissions
import security.workflow.detectors.supply_chain
import security.workflow.events
import security.workflow.finding
import security.workflow.models
import security.workflow.parser
import security.workflow.reporter
import security.workflow.rules


def test_security_package_has_init() -> None:
    """``security/`` is a proper package with ``__init__.py`` for mypy --strict compatibility."""
    import pathlib

    import security

    # security is a regular package with __init__.py
    assert getattr(security, "__file__", None) is not None
    security_init = pathlib.Path(security.__file__)
    assert security_init.name == "__init__.py"
    assert security_init.exists()


def test_workflow_package_imports() -> None:
    import importlib

    importlib.reload(security.workflow)
    assert security.workflow.__doc__


def test_core_modules_import() -> None:
    assert security.workflow.parser.__doc__
    assert security.workflow.analyzer.__doc__
    assert security.workflow.models.__doc__
    assert security.workflow.rules.__doc__
    assert security.workflow.events.__doc__
    assert security.workflow.reporter.__doc__
    assert security.workflow.finding.__doc__


def test_detector_modules_import() -> None:
    assert security.workflow.detectors.injection.__doc__
    assert security.workflow.detectors.commands.__doc__
    assert security.workflow.detectors.permissions.__doc__
    assert security.workflow.detectors.network.__doc__
    assert security.workflow.detectors.modification.__doc__
    assert security.workflow.detectors.supply_chain.__doc__
