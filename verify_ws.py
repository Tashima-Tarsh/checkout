with open('D:/checkout/checkout/checkout/server.py', 'r') as f:
    lines = f.readlines()

in_websocket = False
for i, line in enumerate(lines, 1):
    if '@app.websocket("/android/ws/host")' in line:
        in_websocket = True
    if '@app.websocket("/android/ws/viewer")' in line:
        in_websocket = True
    if in_websocket and 'request.app.state.engine' in line:
        print(f'Line {i}: {line.rstrip()}')
    if in_websocket and 'manager.' in line:
        print(f'Line {i}: {line.rstrip()}')
print('Check complete')