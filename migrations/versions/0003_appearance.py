"""Operator-managed checkout appearance.

Revision ID: 0003_appearance
Revises: 0002_vpa_routes
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_appearance"
down_revision = "0002_vpa_routes"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "checkout_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("brand_name", sa.String(40), nullable=False),
        sa.Column("headline", sa.String(70), nullable=False),
        sa.Column("accent", sa.String(7), nullable=False),
        sa.Column("theme", sa.String(20), nullable=False),
        sa.Column("logo_letter", sa.String(1), nullable=False),
    )

def downgrade():
    op.drop_table("checkout_settings")
