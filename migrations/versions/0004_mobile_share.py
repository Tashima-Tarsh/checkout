"""Payer-submitted evidence digests and one-time share intake.

Revision ID: 0004_mobile_share
Revises: 0003_appearance
"""
from alembic import op
import sqlalchemy as sa
revision = "0004_mobile_share"
down_revision = "0003_appearance"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "checkout_mobile_evidence",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("sid", sa.String(64), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("evidence_hash", sa.String(64), nullable=False),
        sa.Column("length_bytes", sa.Integer, nullable=False),
        sa.Column("created", sa.Integer, nullable=False),
        sa.UniqueConstraint("sid", "evidence_hash", name="uq_checkout_evidence_digest"),
    )
    op.create_table(
        "checkout_share_intake",
        sa.Column("code_hash", sa.String(64), primary_key=True),
        sa.Column("evidence_hash", sa.String(64), nullable=False),
        sa.Column("length_bytes", sa.Integer, nullable=False),
        sa.Column("created", sa.Integer, nullable=False),
        sa.Column("consumed", sa.Boolean, nullable=False),
    )

def downgrade():
    op.drop_table("checkout_share_intake")
    op.drop_table("checkout_mobile_evidence")
