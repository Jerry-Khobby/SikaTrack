"""Settings for the transform step, read from the environment (.env)."""

import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]


def _env_set(name: str) -> frozenset[str]:
    """Comma-separated env var -> normalised set (upper-cased, whitespace collapsed)."""
    values = os.getenv(name, "").split(",")
    return frozenset(" ".join(v.split()).upper() for v in values if v.strip())


@dataclass(frozen=True)
class Owner:
    """Who owns the wallets, so transfers between your own accounts aren't counted as spending."""
    names: frozenset[str] = field(default_factory=frozenset)
    numbers: frozenset[str] = field(default_factory=frozenset)  # local format, e.g. 0241234567

    @classmethod
    def from_env(cls) -> "Owner":
        return cls(names=_env_set("OWNER_NAMES"), numbers=_env_set("OWNER_NUMBERS"))

    def fingerprint(self) -> str:
        """Identifies the settings without revealing them (safe to store in reports)."""
        raw = "|".join(sorted(self.names)) + "#" + "|".join(sorted(self.numbers))
        return hashlib.sha256(raw.encode()).hexdigest()[:12]


@dataclass(frozen=True)
class TransformConfig:
    input_path: Path
    output_dir: Path
    owner: Owner = field(default_factory=Owner)
    balance_tolerance: float = 0.02  # GHS; rounding noise allowed in the balance check
    run_id: str | None = None

    def describe(self) -> dict:
        """The settings that shape the output, for the run report."""
        return {
            "run_id": self.run_id,
            "owner_names": len(self.owner.names),
            "owner_numbers": len(self.owner.numbers),
            "owner_fingerprint": self.owner.fingerprint(),
            "balance_tolerance": self.balance_tolerance,
        }
