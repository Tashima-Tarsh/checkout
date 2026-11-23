from alembic import context

from checkout.storage import make_engine, metadata

if context.is_offline_mode():
    raise RuntimeError("Run migrations against the configured database")

engine = make_engine()
try:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=metadata)
        with context.begin_transaction():
            context.run_migrations()
finally:
    engine.dispose()
