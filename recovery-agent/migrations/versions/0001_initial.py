"""Initial schema for Agentic-Recovery.

Creates all tables for tenants, employees, devices, agents,
collection cases, checkouts, observations, ledger entries,
outbox, and audit events.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ap_tenants",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ap_employees",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column("assigned_device_id", sa.String(64), nullable=True),
        sa.Column("assigned_receiver_upi", sa.String(128), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.ForeignKeyConstraint(["assigned_device_id"], ["ap_android_devices.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_employees_tenant_id", "ap_employees", ["tenant_id"])

    op.create_table(
        "ap_android_devices",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("device_serial", sa.String(128), nullable=True),
        sa.Column("avd_name", sa.String(128), nullable=True),
        sa.Column("registered_upi_id", sa.String(128), nullable=False),
        sa.Column("upi_application", sa.String(64), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("last_heartbeat", sa.BigInteger(), nullable=True),
        sa.Column("connectivity_status", sa.String(32), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_android_devices_tenant_id", "ap_android_devices", ["tenant_id"])

    op.create_table(
        "ap_mobile_agents",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("device_id", sa.String(64), nullable=True),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("observation_cursor", sa.BigInteger(), nullable=True),
        sa.Column("processing_state", sa.String(32), nullable=True),
        sa.Column("last_event_id", sa.String(128), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["ap_android_devices.id"], ),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_mobile_agents_device_id", "ap_mobile_agents", ["device_id"], unique=True)
    op.create_index("ix_ap_mobile_agents_tenant_id", "ap_mobile_agents", ["tenant_id"])

    op.create_table(
        "ap_collection_cases",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("employee_id", sa.String(64), nullable=True),
        sa.Column("device_id", sa.String(64), nullable=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("target_amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=True),
        sa.Column("status", sa.String(32), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.ForeignKeyConstraint(["employee_id"], ["ap_employees.id"], ),
        sa.ForeignKeyConstraint(["device_id"], ["ap_android_devices.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_collection_cases_tenant_id", "ap_collection_cases", ["tenant_id"])
    op.create_index("ix_ap_collection_cases_employee_id", "ap_collection_cases", ["employee_id"])
    op.create_index("ix_ap_collection_cases_device_id", "ap_collection_cases", ["device_id"])

    op.create_table(
        "ap_checkouts",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("employee_id", sa.String(64), nullable=True),
        sa.Column("collection_case_id", sa.String(64), nullable=True),
        sa.Column("device_id", sa.String(64), nullable=True),
        sa.Column("receiver_upi_id", sa.String(128), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=True),
        sa.Column("upi_link", sa.Text(), nullable=True),
        sa.Column("qr_code", sa.Text(), nullable=True),
        sa.Column("state", sa.String(32), nullable=True),
        sa.Column("expires", sa.BigInteger(), nullable=False),
        sa.Column("financially_verified", sa.Boolean(), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.ForeignKeyConstraint(["employee_id"], ["ap_employees.id"], ),
        sa.ForeignKeyConstraint(["collection_case_id"], ["ap_collection_cases.id"], ),
        sa.ForeignKeyConstraint(["device_id"], ["ap_android_devices.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_checkouts_tenant_id", "ap_checkouts", ["tenant_id"])
    op.create_index("ix_ap_checkouts_employee_id", "ap_checkouts", ["employee_id"])
    op.create_index("ix_ap_checkouts_device_id", "ap_checkouts", ["device_id"])

    op.create_table(
        "ap_observations",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("device_id", sa.String(64), nullable=True),
        sa.Column("checkout_id", sa.String(64), nullable=True),
        sa.Column("agent_id", sa.String(64), nullable=True),
        sa.Column("observed_receiver_upi", sa.String(128), nullable=True),
        sa.Column("payer_name", sa.String(128), nullable=True),
        sa.Column("payer_upi_id", sa.String(128), nullable=True),
        sa.Column("amount_paise", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(8), nullable=True),
        sa.Column("utr_rrn", sa.String(64), nullable=True),
        sa.Column("app_transaction_id", sa.String(128), nullable=True),
        sa.Column("transaction_direction", sa.String(16), nullable=True),
        sa.Column("app_reported_status", sa.String(32), nullable=True),
        sa.Column("transaction_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("observation_timestamp", sa.BigInteger(), nullable=False),
        sa.Column("server_ingestion_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("source_application", sa.String(64), nullable=True),
        sa.Column("evidence_type", sa.String(32), nullable=False),
        sa.Column("evidence_fingerprint", sa.String(128), nullable=True),
        sa.Column("observation_authenticity", sa.String(32), nullable=True),
        sa.Column("checkout_correlation", sa.String(32), nullable=True),
        sa.Column("financial_verification", sa.Boolean(), nullable=True),
        sa.Column("duplicate_of", sa.String(128), nullable=True),
        sa.Column("device_signature", sa.String(512), nullable=False),
        sa.Column("signature_timestamp", sa.BigInteger(), nullable=False),
        sa.Column("signature_verified", sa.Boolean(), nullable=True),
        sa.Column("notification_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("capture_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("callback_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("ingestion_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("correlation_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("ledger_timestamp", sa.BigInteger(), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.ForeignKeyConstraint(["device_id"], ["ap_android_devices.id"], ),
        sa.ForeignKeyConstraint(["checkout_id"], ["ap_checkouts.id"], ),
        sa.ForeignKeyConstraint(["agent_id"], ["ap_mobile_agents.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_observations_tenant_id", "ap_observations", ["tenant_id"])
    op.create_index("ix_ap_observations_device_id", "ap_observations", ["device_id"])
    op.create_index("ix_ap_observations_device_ingested", "ap_observations", ["device_id", "server_ingestion_timestamp"])
    op.create_index("ix_ap_observations_utr", "ap_observations", ["utr_rrn"])

    op.create_table(
        "ap_ledger_entries",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("employee_id", sa.String(64), nullable=True),
        sa.Column("checkout_id", sa.String(64), nullable=True),
        sa.Column("observation_id", sa.String(128), nullable=True),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=True),
        sa.Column("entry_type", sa.String(32), nullable=False),
        sa.Column("state", sa.String(32), nullable=True),
        sa.Column("reference", sa.String(128), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.ForeignKeyConstraint(["employee_id"], ["ap_employees.id"], ),
        sa.ForeignKeyConstraint(["checkout_id"], ["ap_checkouts.id"], ),
        sa.ForeignKeyConstraint(["observation_id"], ["ap_observations.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_ledger_entries_tenant_id", "ap_ledger_entries", ["tenant_id"])
    op.create_index("ix_ap_ledger_entries_employee_id", "ap_ledger_entries", ["employee_id"])

    op.create_table(
        "ap_outbox",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("processed", sa.Boolean(), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.Column("processed_at", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_outbox_tenant_id", "ap_outbox", ["tenant_id"])

    op.create_table(
        "ap_audit_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("event", sa.String(64), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_audit_events_tenant_id", "ap_audit_events", ["tenant_id"])

    op.create_table(
        "ap_device_sessions",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("device_id", sa.String(64), nullable=True),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("session_token", sa.String(256), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["ap_android_devices.id"], ),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_device_sessions_device_id", "ap_device_sessions", ["device_id"])

    op.create_table(
        "ap_role_assignments",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=True),
        sa.Column("employee_id", sa.String(64), nullable=True),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("granted_at", sa.BigInteger(), nullable=True),
        sa.Column("granted_by", sa.String(128), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["ap_tenants.id"], ),
        sa.ForeignKeyConstraint(["employee_id"], ["ap_employees.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ap_role_assignments_employee_id", "ap_role_assignments", ["employee_id"])


def downgrade():
    op.drop_table("ap_role_assignments")
    op.drop_table("ap_device_sessions")
    op.drop_table("ap_audit_events")
    op.drop_table("ap_outbox")
    op.drop_table("ap_ledger_entries")
    op.drop_table("ap_observations")
    op.drop_table("ap_checkouts")
    op.drop_table("ap_collection_cases")
    op.drop_table("ap_mobile_agents")
    op.drop_table("ap_android_devices")
    op.drop_table("ap_employees")
    op.drop_table("ap_tenants")
