"""Create persistent checkout, event, and receipt tables."""
from alembic import op
import sqlalchemy as sa

revision = "0001_checkout"
down_revision = None


def upgrade():
    op.create_table(
        "checkout_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("nonce", sa.String(64), nullable=False),
        sa.Column("mode", sa.String(3), nullable=False),
        sa.Column("vpa", sa.String(321), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("mcc", sa.String(4)),
        sa.Column("expires", sa.Integer, nullable=False),
        sa.Column("state", sa.String(40), nullable=False),
    )
    op.create_index("ix_checkout_sessions_expires", "checkout_sessions", ["expires"])
    op.create_table(
        "checkout_events",
        sa.Column("sid", sa.String(64), primary_key=True),
        sa.Column("kind", sa.String(40), primary_key=True),
        sa.Column("created", sa.Integer, nullable=False),
    )
    op.create_table(
        "checkout_receipts",
        sa.Column("issuer", sa.String(32), primary_key=True),
        sa.Column("reference", sa.String(128), primary_key=True),
    )
    op.create_table(
        "checkout_creation_limits",
        sa.Column("bucket", sa.Integer, primary_key=True),
        sa.Column("count", sa.Integer, nullable=False),
    )


def downgrade():
    op.drop_table("checkout_creation_limits")
    op.drop_table("checkout_receipts")
    op.drop_table("checkout_events")
    op.drop_table("checkout_sessions")
