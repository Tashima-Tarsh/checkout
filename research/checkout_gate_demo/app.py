from flask import Flask, jsonify, render_template_string
import sqlite3,time,secrets,threading
from agent import match
app=Flask(__name__)
orders={}; lock=threading.RLock(); db=sqlite3.connect(':memory:',check_same_thread=False)
@app.post('/orders')
def create():
 with lock:
  key=secrets.token_urlsafe(24); orders[key]=dict(account_id='demo-merchant',amount='100.01',created_at=time.time(),state='created'); return jsonify(id=key)
@app.post('/orders/<key>/lock')
def start(key):
 with lock:
  o=orders.get(key)
  if not o:return jsonify(error='not found'),404
  if o['state']=='created':o['state']='locked'
  return jsonify(state=o['state'])
def verify_fixture(key,records):
 with lock:
  o=orders[key]
  if o['state']!='locked':return o['state']
  if time.time()>o['created_at']+90:return 'locked'
  result=match(o,records,db)
  if result['state']=='candidate':
   with db:db.execute('INSERT INTO used VALUES (?,?)',(result['references'][0],key))
   o['state']='demo_verified'
  return o['state']
@app.get('/orders/<key>')
def status(key):
 with lock:
  o=orders.get(key);return (jsonify(state=o['state']),200) if o else (jsonify(error='not found'),404)
@app.get('/')
def index():return render_template_string('''<!doctype html><meta name=viewport content="width=device-width"><title>Checkout gate demo</title><h1>Checkout gate — test only</h1><p>₹100.01 · No actual payment requested.</p><button id=b disabled>I have made the payment</button><p id=s>Creating demo order...</p><script>let id;fetch('/orders',{method:'POST'}).then(r=>r.json()).then(x=>{id=x.id;b.disabled=false;s.textContent='Ready'});b.onclick=async()=>{b.disabled=true;window.open('https://www.upihelp.npci.org.in/','myupi','noopener,noreferrer');await fetch('/orders/'+id+'/lock',{method:'POST'});s.textContent='Locked — awaiting verified evidence';};</script><p>Official page opens separately. No credentials are collected. Live capture is not connected.</p>''')
if __name__=='__main__':app.run(host='127.0.0.1',port=8765)
