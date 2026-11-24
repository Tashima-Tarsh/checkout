"""Internal read-only lookup for a future authorized credit evidence connector."""
from sqlalchemy import select
from checkout.agentic_storage import accounts, orders, verification_claims

def credit_match_context(conn, *, order_id, account_id):
    """Only server-resolved order/account pairs; no public endpoint or paid transition."""
    row = conn.execute(select(
        orders.c.id, orders.c.merchant_id, orders.c.account_id,
        orders.c.amount_minor, orders.c.created, orders.c.expires,
        verification_claims.c.payer_last4,
    ).join(verification_claims, verification_claims.c.order_id == orders.c.id)
     .join(accounts, (accounts.c.id == orders.c.account_id) &
                     (accounts.c.merchant_id == orders.c.merchant_id))
     .where(orders.c.id == order_id, orders.c.account_id == account_id,
            orders.c.status == "PENDING")).mappings().first()
    return dict(row) if row is not None else None
