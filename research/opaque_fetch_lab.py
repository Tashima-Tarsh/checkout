import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'<html>checkout</html>' if self.path == '/' else (b'{"debit":"SUCCESS"}' if self.path == '/paid' else b'{"debit":"FAILED"}')
        self.send_response(200); self.send_header('Content-Type','text/html' if self.path == '/' else 'application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self,*args): pass
servers=[ThreadingHTTPServer(('127.0.0.1',0),Handler) for _ in range(2)]
for s in servers: threading.Thread(target=s.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        b=p.chromium.launch(); page=b.new_page(); page.goto(f'http://127.0.0.1:{servers[0].server_port}/')
        result=page.evaluate('''async base => {const out=[];for(const path of ['/paid','/failed']){const r=await fetch(base+path,{mode:'no-cors'});let cors;try{await fetch(base+path);cors='readable'}catch(e){cors=e.name}out.push({type:r.type,status:r.status,ok:r.ok,body:await r.text(),headers:[...r.headers],cors})}return out}''',f'http://127.0.0.1:{servers[1].server_port}')
        print(b.version,result); assert result[0]==result[1]; assert result[0]==dict(type='opaque',status=0,ok=False,body='',headers=[],cors='TypeError'); b.close()
finally:
    for s in servers:s.shutdown();s.server_close()
