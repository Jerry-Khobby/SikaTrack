"""Baseline: the empty `app` schema the backend owns.

The schema itself is created before any migration runs (alembic/env.py), because Alembic keeps
its version table in it. Tables arrive with phase 2 (accounts and auth).

Revision ID: 0001
Revises:
Create Date: 2026-10-12
"""

from collections.abc import Sequence

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
