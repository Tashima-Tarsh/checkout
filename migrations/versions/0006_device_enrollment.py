"""Preserve legacy revision continuity without creating Agentic Pay tables.

Revision ID: 0006_device_enrollment
Revises: 0005_callback_binding

Agentic Pay uses its own database and guarded schema initializer in
checkout.agentic_storage.initialize(). Device tables are declared in that
module and created there under the existing PostgreSQL advisory lock.
This legacy revision must not create or drop any Agentic Pay objects.
"""

revision = "0006_device_enrollment"
down_revision = "0005_callback_binding"
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
