"""Create separate app-owned databases on an empty Dev or UAT RDS instance."""

import json
import os
from pathlib import Path

import psycopg
from psycopg import sql


DATABASES = {"checkout_app": "checkout_app", "agenticpay": "agenticpay", "n8n": "n8n"}


def bootstrap() -> None:
    environment = os.environ["DISHA_ENVIRONMENT"]
    if environment not in {"dev", "uat"}:
        raise ValueError("DISHA_ENVIRONMENT must be dev or uat")
    host = os.environ["DISHA_RDS_HOST"]
    if not host.endswith(".ap-southeast-2.rds.amazonaws.com"):
        raise ValueError("Expected a Sydney private RDS endpoint")
    credentials = json.loads(Path(os.environ["DISHA_BOOTSTRAP_INPUT"]).read_text())
    passwords = credentials["application_passwords"]
    if set(passwords) != set(DATABASES) or any(
        not isinstance(password, str) or len(password) < 24
        for password in passwords.values()
    ):
        raise ValueError("Expected one strong password per application role")

    with psycopg.connect(
        host=host,
        dbname="postgres",
        user=credentials["admin_username"],
        password=credentials["admin_password"],
        sslmode="verify-full",
        sslrootcert=os.environ["DISHA_RDS_CA_BUNDLE"],
        connect_timeout=10,
        autocommit=True,
    ) as conn:
        conn.execute("SELECT pg_advisory_lock(356078311)")
        for database, role in DATABASES.items():
            owner = conn.execute(
                "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = %s",
                (database,),
            ).fetchone()
            if owner is not None and owner[0] != role:
                raise RuntimeError(f"Refusing to change the owner of {database}")

            role_exists = conn.execute(
                "SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)
            ).fetchone()
            if not role_exists:
                conn.execute(
                    sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                        sql.Identifier(role), sql.Literal(passwords[role])
                    )
                )

            if owner is None:
                admin = sql.Identifier(credentials["admin_username"])
                app_role = sql.Identifier(role)
                can_set_role = conn.execute(
                    "SELECT pg_has_role(current_user, %s, 'SET')", (role,)
                ).fetchone()[0]
                if not can_set_role:
                    conn.execute(
                        sql.SQL("GRANT {} TO {} WITH SET TRUE").format(app_role, admin)
                    )
                try:
                    conn.execute(
                        sql.SQL("CREATE DATABASE {} OWNER {}").format(
                            sql.Identifier(database), app_role
                        )
                    )
                finally:
                    if not can_set_role:
                        conn.execute(
                            sql.SQL("REVOKE SET OPTION FOR {} FROM {}").format(
                                app_role, admin
                            )
                        )

            with psycopg.connect(
                host=host,
                dbname=database,
                user=role,
                password=passwords[role],
                sslmode="verify-full",
                sslrootcert=os.environ["DISHA_RDS_CA_BUNDLE"],
                connect_timeout=10,
            ) as app_conn:
                app_conn.execute(
                    sql.SQL("REVOKE CONNECT, TEMPORARY ON DATABASE {} FROM PUBLIC").format(
                        sql.Identifier(database)
                    )
                )
            print(f"{environment}: verified role and database for {database}")


if __name__ == "__main__":
    bootstrap()
