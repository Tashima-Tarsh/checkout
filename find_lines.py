with open('D:/checkout/checkout/checkout/agentic_api.py', 'r') as f:
    lines = f.readlines()
    for i, line in enumerate(lines, 1):
        if 'def device_heartbeat' in line:
            print(f'device_heartbeat at line {i}')
        if '@router.post("/android/observations"' in line:
            print(f'observations endpoint at line {i}')
