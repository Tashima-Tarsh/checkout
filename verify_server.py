with open('D:/checkout/checkout/checkout/server.py', 'r') as f:
    content = f.read()

windows_terms = ['manager.', 'scrcpy', 'EMULATOR_PATH', 'ADB_PATH', 't_depart', 'start_emulator', 'stop_emulator']
found = False
for term in windows_terms:
    if term in content:
        print(f'WARNING: Found "{term}" in server.py')
        found = True

if not found:
    print('OK: No Windows emulator references in server.py')

host_count = content.count('@app.websocket("/android/ws/host")')
viewer_count = content.count('@app.websocket("/android/ws/viewer")')
print(f'Host WebSocket count: {host_count}')
print(f'Viewer WebSocket count: {viewer_count}')

if host_count > 1 or viewer_count > 1:
    print('WARNING: Duplicate WebSocket routes found!')
else:
    print('OK: No duplicate WebSocket routes')

if 'request.app.state.engine' in content:
    print('WARNING: Found request.app.state.engine in server.py (WebSocket issue)')
else:
    print('OK: No request.app.state.engine in WebSocket handlers')