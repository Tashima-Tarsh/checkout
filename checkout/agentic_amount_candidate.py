"""Amount-only matching cannot prove order attribution. Never confirms credit."""
import re

def candidate_credit(order, rows, *, baseline_references, now):
    if not isinstance(rows, (tuple,list)) or len(rows)>1000 or any(not isinstance(r,dict) for r in rows):
        return "INVALID_EVIDENCE"
    matches = [r for r in rows if r.get("account_id")==order["account_id"]
        and type(r.get("amount_minor")) is int and r["amount_minor"]==order["payable_minor"]
        and r.get("direction")=="CREDIT" and r.get("status")=="SUCCESS"
        and type(r.get("timestamp")) is int and order["created"]<=r["timestamp"]<order["expires"]
        and r["timestamp"]<=now and isinstance(r.get("reference"),str)
        and re.fullmatch(r"[0-9]{12}",r["reference"]) and r["reference"] not in baseline_references]
    return "AMBIGUOUS" if len(matches)>1 else "UNATTRIBUTED_CREDIT" if matches else "NO_MATCH"
