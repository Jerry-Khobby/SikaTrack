"""Quality gates: stop the pipeline when a metric crosses its limit, instead of only logging it.

Limits come from the environment, so they can be tuned without code changes.
"""

import os
from dataclasses import dataclass


class QualityGateError(RuntimeError):
    pass


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value not in (None, "") else default


@dataclass(frozen=True)
class Thresholds:
    min_parse_rate: float = 0.95           # parsed / (parsed + unparsed)
    min_balance_continuity: float = 0.98   # per provider
    max_unexplained_gaps: int = 20

    @classmethod
    def from_env(cls) -> "Thresholds":
        return cls(
            min_parse_rate=_env_float("GATE_MIN_PARSE_RATE", cls.min_parse_rate),
            min_balance_continuity=_env_float("GATE_MIN_BALANCE_CONTINUITY", cls.min_balance_continuity),
            max_unexplained_gaps=int(_env_float("GATE_MAX_UNEXPLAINED_GAPS", cls.max_unexplained_gaps)),
        )


def check_parse(stats: dict, limits: Thresholds) -> None:
    failures = []
    if stats["parsed"] == 0:
        failures.append("no transactions parsed")
    rate = stats["parse_success_rate"]
    if rate is not None and rate < limits.min_parse_rate:
        failures.append(f"parse rate {rate:.1%} < {limits.min_parse_rate:.1%} "
                        f"({stats['unparsed']} unparsed; add templates for the new formats)")
    _raise_if(failures, "parse")


def check_transform(report: dict, limits: Thresholds) -> None:
    failures = []
    for provider, stats in report["providers"].items():
        if stats["balance_checked"] and stats["continuity_rate"] < limits.min_balance_continuity:
            failures.append(f"{provider} balance continuity {stats['continuity_rate']:.1%} "
                            f"< {limits.min_balance_continuity:.1%}")
    unexplained = report["balance_gap_reasons"].get("unexplained", 0)
    if unexplained > limits.max_unexplained_gaps:
        failures.append(f"{unexplained} unexplained balance gaps > {limits.max_unexplained_gaps}")
    _raise_if(failures, "transform")


def _raise_if(failures: list[str], step: str) -> None:
    if failures:
        raise QualityGateError(f"Quality gate failed after {step}: " + "; ".join(failures))
