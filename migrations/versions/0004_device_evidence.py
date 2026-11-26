"""Add financially_verified flag and debit-evidence table.

Revision ID: 0004_device_evidence
Revises: 0003_appearance
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_device_evidence"
down_revision = "0003_appearance"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "checkout_sessions",
        sa.Column("financially_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "checkout_debit_evidence",
        sa.Column("sid", sa.String(64), primary_key=True),
        sa.Column("utr", sa.String(128)),
        sa.Column("payer_transaction_id", sa.String(128)),
        sa.Column("amount_minor", sa.Integer()),
        sa.Column("payee_vpa", sa.String(321)),
        sa.Column("claimed_paid_at", sa.Integer()),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("server_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("checkout_debit_evidence")
    op.drop_column("checkout_sessions", "financially_verified")
