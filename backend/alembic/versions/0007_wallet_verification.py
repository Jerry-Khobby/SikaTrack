"""Wallet verification: a code texted to the wallet's number proves the user holds that SIM.

Codes now have a purpose, so a wallet code can't sign anyone in and a sign-in code can't
verify a wallet. Existing wallets on the account's own number count as verified (signing in
already proved that number); any others wait for a code.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("wallet", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True), schema="app")
    op.add_column(
        "otp_request",
        sa.Column("purpose", sa.String(length=10), server_default="sign_in", nullable=False),
        schema="app",
    )
    op.add_column(
        "otp_request", sa.Column("wallet_id", postgresql.UUID(as_uuid=True), nullable=True), schema="app"
    )
    op.create_foreign_key(
        op.f("fk_otp_request_wallet_id_wallet"),
        "otp_request",
        "wallet",
        ["wallet_id"],
        ["id"],
        source_schema="app",
        referent_schema="app",
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_otp_request_wallet_id"), "otp_request", ["wallet_id"], schema="app")
    op.execute(
        'UPDATE app.wallet w SET verified_at = w.created_at FROM app."user" u '
        "WHERE u.id = w.user_id AND u.phone_number = w.phone_number"
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_otp_request_wallet_id"), table_name="otp_request", schema="app")
    op.drop_constraint(
        op.f("fk_otp_request_wallet_id_wallet"), "otp_request", schema="app", type_="foreignkey"
    )
    op.drop_column("otp_request", "wallet_id", schema="app")
    op.drop_column("otp_request", "purpose", schema="app")
    op.drop_column("wallet", "verified_at", schema="app")
