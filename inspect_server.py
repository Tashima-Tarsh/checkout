with open('D:\\checkout\\checkout\\checkout\\server.py', 'rb') as f:
    data = f.read()
# Find the start of _auth_ws
idx = data.find(b'async def _auth_ws')
if idx >= 0:
    print(repr(data[idx:idx+200]))
print('---')
# Find the end of android_ws_viewer  
idx2 = data.find(b'app.mount("/android/assets"')
if idx2 >= 0:
    print(repr(data[idx2-50:idx2+100]))
print('---')
# Find the mount after viewer
idx3 = data.find(b'app.mount("/android/assets"')
print(f'app.mount at: {idx3}')
