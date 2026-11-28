with open('D:/checkout/checkout/checkout/agentic_api.py', 'rb') as f:
    content = f.read()

target = b'event(conn, row["device_id"], "DEVICE_HEARTBEAT")'
idx = content.find(target)
print(f'Found at byte {idx}: {content[idx:idx+80]}')

if idx >= 0:
    insert_pos = idx + len(target)
    nl_pos = content.find(b'\n', insert_pos)
    insert_pos = nl_pos + 1

    new_code = b'\n@app.router.post("/api/demo/sessions/{sid}/issue-test-proof", response_model=dict)\n'
    new_code += b'def issue_test_proof(sid: str, request: Request, authorization: Token = None):\n'
    new_code += b'    """Issue a test proof for a session (demo endpoint for testing replay protection).\n'
    new_code += b'    Returns a test receipt that can be submitted via /api/android/observations.\n'
    new_code += b'    """\n'
    new_code += b'    row = device_bearer(request, authorization)\n'
    new_code += b'    order_id = sid\n'
    new_code += b'    now_ts = int(time.time())\n'
    new_code += b'    with request.app.state.engine.begin() as conn:\n'
    new_code += b'        order = conn.execute(select(orders).where(orders.c.id == order_id)).mappings().first()\n'
    new_code += b'        if order is None:\n'
    new_code += b'            raise HTTPException(404, "Order not found")\n'
    new_code += b'        test_utr = "TEST_" + secrets.token_hex(8)\n'
    new_code += b'        conn.execute(events.insert().values(\n')
    new_code += b'            order_id=order_id,\n')
    new_code += b'            account_id=order["account_id"],\n')
    new_code += b'            amount_paise=int(order["amount_minor"]),\n')
    new_code += b'            currency="INR",\n')
    new_code += b'            transaction_reference=test_utr,\n')
    new_code += b'            observation_direction="incoming",\n')
    new_code += b'            evidence_provenance="test_proof",\n')
    new_code += b'            observation_timestamp=now_ts,\n')
    new_code += b'            checkout_created=int(order["created"]),\n')
    new_code += b'            checkout_expires=int(order["expires"]),\n')
    new_code += b'            state="OBSERVATION_RECEIVED",\n')
    new_code += b'        ))\n')
    new_code += b'    return {\n'
    new_code += b'        "order_id": order_id,\n'
    new_code += b'        "utr": test_utr,\n'
    new_code += b'        "amount_paise": int(order["amount_minor"]),\n')
    new_code += b'        "state": "OBSERVATION_RECEIVED",\n'
    new_code += b'    }\n'
    new_code += b'\n'

    new_content = content[:insert_pos] + new_code + content[insert_pos:]

    with open('D:/checkout/checkout/checkout/agentic_api.py', 'wb') as f:
        f.write(new_content)

    print(f'Inserted at byte {insert_pos}')
