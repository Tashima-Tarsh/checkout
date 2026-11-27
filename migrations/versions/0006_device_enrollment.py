"""Add device enrollment, pairing, credentials, observations, and heartbeats tables.

Adds support for Android receiver device enrollment with short-lived pairing codes,
device-scoped authentication credentials, heartbeat tracking, and transaction-specific
evidence submission from enrolled devices.

Revision ID: 0006_device_enrollment
Revises: 0005_callback_binding
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_device_enrollment"
down_revision = "0005_callback_binding"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ap_devices",
        sa.Column("device_id", sa.String(64), primary_key=True),
        sa.Column("merchant_id", sa.String(32), sa.ForeignKey("ap_merchants.id"), nullable=False, index=True),
        sa.Column("agent_id", sa.String(32), nullable=False, index=True),
        sa.Column("public_key_pem", sa.Text(), nullable=False),
        sa.Column("state", sa.String(32), nullable=False, server_default="ENROLLMENT_PENDING"),
        sa.Column("created", sa.BigInteger(), nullable=False),
        sa.Column("last_heartbeat", sa.BigInteger(), nullable=True),
        sa.Column("app_version", sa.String(32), nullable=True),
        sa.Column("revoked_at", sa.BigInteger(), nullable=True),
        sa.Column("revoked_reason", sa.String(64), nullable=True),
    )

    op.create_table(
        "ap_pairing_codes",
        sa.Column("code_hash", sa.String(64), primary_key=True),
        sa.Column("merchant_id", sa.String(32), sa.ForeignKey("ap_merchants.id"), nullable=False, index=True),
        sa.Column("agent_id", sa.String(32), nullable=False, index=True),
        sa.Column("device_id", sa.String(64), nullable=True),
        sa.Column("expires", sa.BigInteger(), nullable=False),
        sa.Column("used", sa.BigInteger(), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=False),
    )

    op.create_table(
        "ap_device_credentials",
        sa.Column("device_id", sa.String(64), sa.ForeignKey("ap_devices.device_id"), primary_key=True),
        sa.Column("credential_hash", sa.String(64), nullable=False),
        sa.Column("created", sa.BigInteger(), nullable=False),
        sa.Column("expires", sa.BigInteger(), nullable=True),
        sa.Column("revoked", sa.BigInteger(), nullable=True),
    )

    op.create_table(
        "ap_device_observations",
        sa.Column("observation_id", sa.String(64), primary_key=True),
        sa.Column("device_id", sa.String(64), sa.ForeignKey("ap_devices.device_id"), nullable=False, index=True),
        sa.Column("order_id", sa.String(48), sa.ForeignKey("ap_orders.id"), nullable=False, index=True),
        sa.Column("merchant_id", sa.String(32), sa.ForeignKey("ap_merchants.id"), nullable=False, index=True),
        sa.Column("account_id", sa.String(32), sa.ForeignKey("ap_accounts.id"), nullable=False, index=True),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("transaction_reference", sa.String(128), nullable=True),
        sa.Column("observation_direction", sa.String(16), nullable=False),
        sa.Column("evidence_provenance", sa.String(32), nullable=False),
        sa.Column("observation_timestamp", sa.BigInteger(), nullable=False),
        sa.Column("checkout_created", sa.BigInteger(), nullable=False),
        sa.Column("checkout_expires", sa.BigInteger(), nullable=False),
        sa.Column("state", sa.String(32), nullable=False, server_default="OBSERVATION_RECEIVED"),
        sa.Column("created", sa.BigInteger(), nullable=False),
        sa.Column("matched_at", sa.BigInteger(), nullable=True),
        sa.Column("decision", sa.String(32), nullable=True),
        sa.Column("rejection_reason", sa.String(64), nullable=True),
    )

    op.create_table(
        "ap_device_heartbeats",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer, "sqlite"), primary_key=True),
        sa.Column("device_id", sa.String(64), sa.ForeignKey("ap_devices.device_id"), nullable=False, index=True),
        sa.Column("received_at", sa.BigInteger(), nullable=False),
        sa.Column("created", sa.BigInteger(), nullable=False),
    )


def downgrade():
    op.drop_table("ap_device_heartbeats")
    op.drop_table("ap_device_observations")
    op.drop_table("ap_device_credentials")
    op.drop_table("ap_pairing_codes")
    op.drop_table("ap_devices")
