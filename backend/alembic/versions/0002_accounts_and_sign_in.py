"""Accounts and sign-in: users, one-time codes, devices, sessions, audit log.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-12 12:20:08.764498
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_event",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column(
            "detail",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_event")),
        schema="app",
    )
    op.create_index(op.f("ix_audit_event_user_id"), "audit_event", ["user_id"], unique=False, schema="app")
    op.create_table(
        "otp_request",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("phone_number", sa.String(length=16), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_ip", postgresql.INET(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_otp_request")),
        schema="app",
    )
    op.create_index(
        op.f("ix_otp_request_phone_number_created_at"),
        "otp_request",
        ["phone_number", "created_at"],
        unique=False,
        schema="app",
    )
    op.create_index(
        op.f("ix_otp_request_requested_ip_created_at"),
        "otp_request",
        ["requested_ip", "created_at"],
        unique=False,
        schema="app",
    )
    op.create_table(
        "user",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("phone_number", sa.String(length=16), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=True),
        sa.Column("status", sa.String(length=12), server_default="active", nullable=False),
        sa.Column("delete_after", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "settings",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "onboarding",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user")),
        sa.UniqueConstraint("phone_number", name=op.f("uq_user_phone_number")),
        sa.CheckConstraint("status IN ('active', 'deleting')", name=op.f("ck_user_status")),
        schema="app",
    )
    op.create_table(
        "device",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("platform", sa.String(length=10), nullable=False),
        sa.Column("model", sa.String(length=80), nullable=True),
        sa.Column("app_version", sa.String(length=20), nullable=True),
        sa.Column("push_token", sa.String(length=255), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_device_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_device")),
        schema="app",
    )
    op.create_index(op.f("ix_device_user_id"), "device", ["user_id"], unique=False, schema="app")
    op.create_table(
        "session",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("device_id", sa.UUID(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("previous_token_hash", sa.String(length=64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["device_id"], ["app.device.id"], name=op.f("fk_session_device_id_device"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_session_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session")),
        sa.UniqueConstraint("refresh_token_hash", name=op.f("uq_session_refresh_token_hash")),
        schema="app",
    )
    op.create_index(op.f("ix_session_device_id"), "session", ["device_id"], unique=False, schema="app")
    op.create_index(
        op.f("ix_session_previous_token_hash"), "session", ["previous_token_hash"], unique=False, schema="app"
    )
    op.create_index(op.f("ix_session_user_id"), "session", ["user_id"], unique=False, schema="app")


def downgrade() -> None:
    op.drop_index(op.f("ix_session_user_id"), table_name="session", schema="app")
    op.drop_index(op.f("ix_session_previous_token_hash"), table_name="session", schema="app")
    op.drop_index(op.f("ix_session_device_id"), table_name="session", schema="app")
    op.drop_table("session", schema="app")
    op.drop_index(op.f("ix_device_user_id"), table_name="device", schema="app")
    op.drop_table("device", schema="app")
    op.drop_table("user", schema="app")
    op.drop_index(op.f("ix_otp_request_requested_ip_created_at"), table_name="otp_request", schema="app")
    op.drop_index(op.f("ix_otp_request_phone_number_created_at"), table_name="otp_request", schema="app")
    op.drop_table("otp_request", schema="app")
    op.drop_index(op.f("ix_audit_event_user_id"), table_name="audit_event", schema="app")
    op.drop_table("audit_event", schema="app")
