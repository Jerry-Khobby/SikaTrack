"""The pipeline's sample MoMo SMS (made-up names and numbers), loaded from data-engineering, so
the backend is tested on exactly the messages the parser's own tests use."""

import importlib.util
from pathlib import Path
from types import ModuleType

_PATH = Path(__file__).parents[2] / "data-engineering" / "test" / "samples.py"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("pipeline_samples", _PATH)
    assert spec is not None, f"pipeline samples not found at {_PATH}"
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


samples = _load()
