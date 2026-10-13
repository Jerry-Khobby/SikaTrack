"""User input: category corrections, counterparty nicknames, recurring decisions, budgets.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-12 13:45:06.005958
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "budget",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("category_name", sa.String(length=50), nullable=False),
        sa.Column("monthly_limit", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("alert_thresholds", postgresql.ARRAY(sa.Numeric(precision=4, scale=3)), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_budget_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budget")),
        sa.UniqueConstraint("user_id", "category_name", name=op.f("uq_budget_user_id_category_name")),
        schema="app",
    )
    op.create_index(op.f("ix_budget_user_id"), "budget", ["user_id"], unique=False, schema="app")
    op.create_table(
        "category_override",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("transaction_nk", sa.String(length=80), nullable=False),
        sa.Column("category_name", sa.String(length=50), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_category_override_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "transaction_nk", name=op.f("pk_category_override")),
        schema="app",
    )
    op.create_table(
        "counterparty_preference",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("counterparty_name", sa.String(length=200), nullable=False),
        sa.Column("alias", sa.String(length=80), nullable=True),
        sa.Column("default_category", sa.String(length=50), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app.user.id"],
            name=op.f("fk_counterparty_preference_user_id_user"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "counterparty_name", name=op.f("pk_counterparty_preference")),
        schema="app",
    )
    op.create_table(
        "recurring_preference",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("recurring_series", sa.String(length=20), nullable=False),
        sa.Column("user_state", sa.String(length=16), nullable=True),
        sa.Column("label", sa.String(length=80), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app.user.id"],
            name=op.f("fk_recurring_preference_user_id_user"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "recurring_series", name=op.f("pk_recurring_preference")),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("recurring_preference", schema="app")
    op.drop_table("counterparty_preference", schema="app")
    op.drop_table("category_override", schema="app")
    op.drop_index(op.f("ix_budget_user_id"), table_name="budget", schema="app")
    op.drop_table("budget", schema="app")
