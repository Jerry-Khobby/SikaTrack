"""Sign in with Google: an account can be keyed on a Google account instead of a phone number.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("user", "phone_number", existing_type=sa.String(length=16), nullable=True, schema="app")
    op.add_column("user", sa.Column("google_sub", sa.String(length=64), nullable=True), schema="app")
    op.add_column("user", sa.Column("email", sa.String(length=254), nullable=True), schema="app")
    op.create_unique_constraint(op.f("uq_user_google_sub"), "user", ["google_sub"], schema="app")


def downgrade() -> None:
    op.drop_constraint(op.f("uq_user_google_sub"), "user", schema="app", type_="unique")
    op.drop_column("user", "email", schema="app")
    op.drop_column("user", "google_sub", schema="app")
    op.alter_column("user", "phone_number", existing_type=sa.String(length=16), nullable=False, schema="app")
