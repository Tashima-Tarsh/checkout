import argparse, json, sqlite3
from decimal import Decimal

def paisa(v):
    d=Decimal(str(v))*100
    if d != d.to_integral_value() or d<=0: raise ValueError('invalid amount')
    return int(d)

def match(order, records, db):
    db.execute('CREATE TABLE IF NOT EXISTS used (ref TEXT PRIMARY KEY, order_id TEXT UNIQUE)')
    found=[]
    for r in records:
        try:
            if (r['direction'].upper()=='CREDIT' and r['status'].upper()=='SUCCESS' and r['account_id']==order['account_id'] and paisa(r['amount'])==paisa(order['amount']) and 0<=float(r['timestamp'])-float(order['created_at'])<=90 and r['reference'] and not db.execute('SELECT 1 FROM used WHERE ref=?',(r['reference'],)).fetchone()): found.append(r)
        except (KeyError,ValueError,ArithmeticError,TypeError): continue
    return {'state':'candidate' if len(found)==1 else 'pending','references':[r['reference'] for r in found], 'reason':'Requires trusted evidence; no payment confirmation' if len(found)==1 else 'No unique match'}

def main():
    p=argparse.ArgumentParser(); p.add_argument('order'); p.add_argument('records'); a=p.parse_args()
    with sqlite3.connect(':memory:') as db: print(json.dumps(match(json.load(open(a.order)),json.load(open(a.records)),db),indent=2))
if __name__=='__main__': main()
