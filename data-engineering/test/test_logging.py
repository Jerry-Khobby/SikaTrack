import csv
import importlib
import logging

import pytest

import samples as s
from src.extraction.momo_parser import parse_file
from src.utils.logging_config import setup_logging


@pytest.fixture
def restore_logging():
    root = logging.getLogger()
    handlers, level = root.handlers[:], root.level
    yield
    for h in root.handlers:
        if h not in handlers:
            h.close()
    root.handlers, root.level = handlers, level


def test_setup_logging_writes_to_file(tmp_path, restore_logging):
    path = setup_logging("DEBUG", log_dir=tmp_path)
    logging.getLogger("src.example").debug("hello from a module")

    for h in logging.getLogger().handlers:
        h.flush()
    line = path.read_text(encoding="utf-8").strip()
    assert line.endswith("| DEBUG   | src.example | hello from a module")


def test_setup_logging_level_comes_from_env(tmp_path, monkeypatch, restore_logging):
    monkeypatch.setenv("LOG_LEVEL", "warning")
    setup_logging(log_dir=tmp_path)
    assert logging.getLogger().level == logging.WARNING


def test_importing_modules_does_not_configure_logging():
    import src.extraction.filter_sms as filter_sms  # used to call basicConfig on import
    import src.orchestration.pipeline as pipeline

    root = logging.getLogger()
    before = (root.handlers[:], root.level)
    for module in (filter_sms, pipeline):
        importlib.reload(module)

    assert (root.handlers, root.level) == before


def test_parser_logs_each_problem_message(tmp_path, caplog):
    source = tmp_path / "momo_sms.csv"
    with open(source, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["message_id", "raw_text", "sender", "received_at"])
        w.writeheader()
        w.writerow({"message_id": "new1", "raw_text": "Brand new format.", "sender": s.MTN, "received_at": "t"})
        w.writerow({"message_id": "otp1", "raw_text": s.OTP, "sender": s.MTN, "received_at": "t"})

    with caplog.at_level(logging.DEBUG):
        parse_file(source, tmp_path / "parsed.json", tmp_path / "unparsed.csv")

    messages = [(r.levelname, r.getMessage()) for r in caplog.records]
    assert ("WARNING", "Unparsed new1 (unknown format): Brand new format.") in messages
    assert ("DEBUG", "Ignored otp1 as otp") in messages
    assert any(level == "INFO" and msg.startswith("Parsed 2 messages") for level, msg in messages)
