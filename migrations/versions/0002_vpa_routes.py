"""Allowlisted multi-VPA routing inventory.

Revision ID: 0002_vpa_routes
Revises: 0001_checkout
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_vpa_routes"
down_revision = "0001_checkout"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "checkout_vpa_routes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("route_key", sa.String(64), nullable=False),
        sa.Column("mode", sa.String(3), nullable=False),
        sa.Column("vpa", sa.String(321), nullable=False),
        sa.Column("mcc", sa.String(4), nullable=True),
        sa.Column("priority", sa.Integer, nullable=False),
        sa.Column("enabled", sa.Boolean, nullable=False),
    )
    op.create_index("ix_checkout_vpa_routes_match", "checkout_vpa_routes", ["route_key", "mode", "enabled", "priority"])

def downgrade():
    op.drop_index("ix_checkout_vpa_routes_match", table_name="checkout_vpa_routes")
    op.drop_table("checkout_vpa_routes")
