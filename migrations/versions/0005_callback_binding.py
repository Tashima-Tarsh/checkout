"""Add UPI callback binding columns to checkout sessions.

Adds tr (session binding token), t_depart (server-clocked departure time),
and callback (HTTPS endpoint the UPI app returns to) so P2P intents can be
merchant-shaped and verified server-side.
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_callback_binding"
down_revision = "0004_device_evidence"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("checkout_sessions", sa.Column("tr", sa.String(35)))
    op.add_column("checkout_sessions", sa.Column("t_depart", sa.Integer()))
    op.add_column("checkout_sessions", sa.Column("callback", sa.String(512)))


def downgrade():
    op.drop_column("checkout_sessions", "tr")
    op.drop_column("checkout_sessions", "t_depart")
    op.drop_column("checkout_sessions", "callback")
