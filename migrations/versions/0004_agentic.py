"""Agentic account inventory."""
from alembic import op
from checkout.agentic_storage import accounts, agent_sessions, consumed
revision = "0004_agentic"
down_revision = "0003_appearance"
branch_labels = None
depends_on = None

def upgrade():
    for table in (accounts, agent_sessions, consumed):
        table.create(op.get_bind())

def downgrade():
    for table in (consumed, agent_sessions, accounts):
        table.drop(op.get_bind())
