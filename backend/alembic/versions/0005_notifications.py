"""Notifications: the in-app inbox (also pushed to phones), deduplicated per user.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-12 14:01:03.845353
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.String(length=500), nullable=False),
        sa.Column("link", sa.String(length=200), nullable=True),
        sa.Column("dedupe_key", sa.String(length=120), nullable=False),
        sa.Column("pushed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_notification_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification")),
        sa.UniqueConstraint("user_id", "dedupe_key", name=op.f("uq_notification_user_id_dedupe_key")),
        schema="app",
    )
    op.create_index(
        op.f("ix_notification_user_id_created_at"),
        "notification",
        ["user_id", "created_at"],
        unique=False,
        schema="app",
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_user_id_created_at"), table_name="notification", schema="app")
    op.drop_table("notification", schema="app")
