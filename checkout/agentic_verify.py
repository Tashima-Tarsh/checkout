"""Candidate matching never confers financial verification."""
import re

def match(order, rows):
    matches=[r for r in rows if r.get("account_id")==order["account_id"]
        and type(r.get("amount_minor")) is int and r["amount_minor"]==order["amount_minor"]
        and r.get("payer_last4")==order["payer_last4"]
        and r.get("direction")=="CREDIT" and r.get("status")=="SUCCESS"
        and type(r.get("timestamp")) is int and order["created"]<=r["timestamp"]<=order["expires"]
        and isinstance(r.get("reference"),str) and re.fullmatch(r"[0-9]{12}",r["reference"])]
    return {"state":"PENDING","financially_verified":False,
            "reason":"UNATTESTED_CANDIDATE" if len(matches)==1 else "AMBIGUOUS" if matches else "NO_MATCH"}
