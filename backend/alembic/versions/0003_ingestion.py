"""Ingestion: wallets, SMS batches, seen SMS, provisional transactions, pipeline events.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-12 13:14:07.252638
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pipeline_event",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("run_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_pipeline_event_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pipeline_event")),
        schema="app",
    )
    op.create_index(
        op.f("ix_pipeline_event_user_id_finished_at"),
        "pipeline_event",
        ["user_id", "finished_at"],
        unique=False,
        schema="app",
    )
    op.create_table(
        "wallet",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider_code", sa.String(length=30), nullable=False),
        sa.Column("phone_number", sa.String(length=16), nullable=False),
        sa.Column("account_name", sa.String(length=200), nullable=True),
        sa.Column("label", sa.String(length=60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_wallet_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_wallet")),
        sa.UniqueConstraint(
            "user_id",
            "provider_code",
            "phone_number",
            name=op.f("uq_wallet_user_id_provider_code_phone_number"),
        ),
        schema="app",
    )
    op.create_index(op.f("ix_wallet_user_id"), "wallet", ["user_id"], unique=False, schema="app")
    op.create_table(
        "sms_batch",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("device_id", sa.UUID(), nullable=True),
        sa.Column("idempotency_key", sa.UUID(), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("raw_object_key", sa.String(length=500), nullable=True),
        sa.Column("received", sa.Integer(), nullable=False),
        sa.Column("accepted", sa.Integer(), nullable=False),
        sa.Column("duplicates", sa.Integer(), nullable=False),
        sa.Column("latest_date_ms", sa.BigInteger(), nullable=True),
        sa.Column("status", sa.String(length=12), server_default="received", nullable=False),
        sa.Column("pipeline_run_id", sa.String(length=60), nullable=True),
        sa.Column("response", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("loaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["device_id"], ["app.device.id"], name=op.f("fk_sms_batch_device_id_device"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_sms_batch_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sms_batch")),
        sa.UniqueConstraint("user_id", "idempotency_key", name=op.f("uq_sms_batch_user_id_idempotency_key")),
        schema="app",
    )
    op.create_index(op.f("ix_sms_batch_user_id"), "sms_batch", ["user_id"], unique=False, schema="app")
    op.create_table(
        "provisional_transaction",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.String(length=16), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("transaction_nk", sa.String(length=80), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider_code", sa.String(length=30), nullable=True),
        sa.Column("template", sa.String(length=50), nullable=True),
        sa.Column("transaction_type", sa.String(length=30), nullable=True),
        sa.Column("direction", sa.String(length=6), nullable=True),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("fee", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("tax", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("balance_after", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("counterparty", sa.String(length=200), nullable=True),
        sa.Column("counterparty_kind", sa.String(length=30), nullable=True),
        sa.Column("reference", sa.String(length=255), nullable=True),
        sa.Column("is_own_transfer", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("category_name", sa.String(length=50), nullable=True),
        sa.Column("category_rule", sa.String(length=80), nullable=True),
        sa.Column("parse_status", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["app.sms_batch.id"],
            name=op.f("fk_provisional_transaction_batch_id_sms_batch"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app.user.id"],
            name=op.f("fk_provisional_transaction_user_id_user"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "message_id", name=op.f("pk_provisional_transaction")),
        schema="app",
    )
    op.create_index(
        op.f("ix_provisional_transaction_batch_id"),
        "provisional_transaction",
        ["batch_id"],
        unique=False,
        schema="app",
    )
    op.create_index(
        op.f("ix_provisional_transaction_transaction_nk"),
        "provisional_transaction",
        ["transaction_nk"],
        unique=False,
        schema="app",
    )
    op.create_table(
        "sms_seen",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.String(length=16), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("date_ms", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["app.sms_batch.id"],
            name=op.f("fk_sms_seen_batch_id_sms_batch"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app.user.id"], name=op.f("fk_sms_seen_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "message_id", name=op.f("pk_sms_seen")),
        schema="app",
    )
    op.create_index(op.f("ix_sms_seen_batch_id"), "sms_seen", ["batch_id"], unique=False, schema="app")
    op.add_column(
        "user", sa.Column("pipeline_due_at", sa.DateTime(timezone=True), nullable=True), schema="app"
    )
    op.create_index(op.f("ix_user_pipeline_due_at"), "user", ["pipeline_due_at"], unique=False, schema="app")


def downgrade() -> None:
    op.drop_index(op.f("ix_user_pipeline_due_at"), table_name="user", schema="app")
    op.drop_column("user", "pipeline_due_at", schema="app")
    op.drop_index(op.f("ix_sms_seen_batch_id"), table_name="sms_seen", schema="app")
    op.drop_table("sms_seen", schema="app")
    op.drop_index(
        op.f("ix_provisional_transaction_transaction_nk"), table_name="provisional_transaction", schema="app"
    )
    op.drop_index(
        op.f("ix_provisional_transaction_batch_id"), table_name="provisional_transaction", schema="app"
    )
    op.drop_table("provisional_transaction", schema="app")
    op.drop_index(op.f("ix_sms_batch_user_id"), table_name="sms_batch", schema="app")
    op.drop_table("sms_batch", schema="app")
    op.drop_index(op.f("ix_wallet_user_id"), table_name="wallet", schema="app")
    op.drop_table("wallet", schema="app")
    op.drop_index(op.f("ix_pipeline_event_user_id_finished_at"), table_name="pipeline_event", schema="app")
    op.drop_table("pipeline_event", schema="app")
