with open('D:/checkout/checkout/checkout/agentic_api.py', 'r') as f:
    lines = f.readlines()
    for i, line in enumerate(lines, 1):
        if 'DEVICE_HEARTBEAT' in line:
            print(f'Line {i}: {repr(line)}')