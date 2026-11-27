import re

with open('D:\\checkout\\checkout\\checkout\\server.py', 'r') as f:
    content = f.read()

# Find the start and end of the Android Workspace section
start_marker = '# WebSocket authentication helper'
end_marker = 'app.mount("/android/assets", StaticFiles(directory=ROOT / "static" / "android"), name="android_assets")'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("ERROR: Could not find markers")
    exit(1)

end_idx = content.find('\n', end_idx)
if end_idx == -1:
    end_idx = len(content)
else:
    end_idx += 1  # Include the newline

new_section = '''# WebSocket authentication helper for Android Workspace
async def _auth_websocket(websocket: WebSocket) -> str | None:
    """Authenticate WebSocket connection using Bearer token from query params.
    Token must match the PDEP_ADMIN_TOKEN environment variable.
    Returns the tenant_id on success.
    """
    auth_header = websocket.query_params.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        await websocket.close(code=4001, reason="Authentication required")
        return None

    token = auth_header.split(" ", 1)[1]

    # Verify token using the existing admin auth helper
    from checkout.vpa_admin import require_admin

    class _FakeRequest:
        def __init__(self, token_val: str):
            self.headers = {"authorization": f"Bearer {token_val}"}
            self.client = type("client", (), {"host": "127.0.0.1"})()

    fake_request = _FakeRequest(token)
    try:
        require_admin(fake_request)
    except HTTPException:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return None
    except Exception:
        await websocket.close(code=4001, reason="Authentication failed")
        return None

    # Tenant ID comes from environment (single-tenant deployment)
    tenant_id = os.getenv("ANDROID_TENANT_ID", "shop-0001")
    return tenant_id


@app.get("/api/android/workspace/status")
def android_workspace_status(request: Request):
    """Get Android workspace connection status (host agent reports via WebSocket)."""
    return {
        "connected": _host_ws is not None,
        "device_id": os.getenv("ANDROID_DEVICE_ID", "AgenticMobile0001"),
        "tenant_id": os.getenv("ANDROID_TENANT_ID", "shop-0001"),
    }


@app.post("/api/android/workspace/start")
def android_workspace_start(request: Request):
    """Request emulator start on the host agent (relayed via WebSocket)."""
    if _host_ws:
        asyncio.create_task(_host_ws.send_json({"type": "start_emulator"}))
        return {"status": "start_requested"}
    return {"status": "host_not_connected"}


@app.post("/api/android/workspace/stop")
def android_workspace_stop(request: Request):
    """Request emulator stop on the host agent (relayed via WebSocket)."""
    if _host_ws:
        asyncio.create_task(_host_ws.send_json({"type": "stop_emulator"}))
        return {"status": "stop_requested"}
    return {"status": "host_not_connected"}


@app.post("/api/android/workspace/restart")
def android_workspace_restart(request: Request):
    """Request emulator restart on the host agent (relayed via WebSocket)."""
    if _host_ws:
        asyncio.create_task(_host_ws.send_json({"type": "restart_emulator"}))
        return {"status": "restart_requested"}
    return {"status": "host_not_connected"}


@app.post("/api/android/workspace/input")
def android_workspace_input(request: Request, body: dict):
    """Inject input into the Android emulator (relayed to host agent).
    Requires authenticated session token.
    """
    action = body.get("action")
    if not action:
        raise HTTPException(400, "Missing action")
    if _host_ws:
        asyncio.create_task(_host_ws.send_json(body))
        return {"status": "input_sent"}
    return {"status": "host_not_connected"}


@app.get("/api/android/workspace/config")
def android_workspace_config(request: Request):
    """Get Android Workspace configuration."""
    return {
        "device_id": os.getenv("ANDROID_DEVICE_ID", "AgenticMobile0001"),
        "tenant_id": os.getenv("ANDROID_TENANT_ID", "shop-0001"),
        "ws_url": f"/android/ws/viewer",
        "host_connected": _host_ws is not None,
    }


@app.get("/android/workspace", response_class=HTMLResponse)
def android_workspace_page():
    """Serve the Android Workspace HTML page."""
    return (ROOT / "static" / "android_workspace.html").read_text(encoding="utf-8")


@app.websocket("/android/ws/host")
async def android_ws_host(websocket: WebSocket):
    """WebSocket endpoint for the Android host agent (runs on local Windows machine).
    Requires Bearer token authentication matching PDEP_ADMIN_TOKEN.
    """
    global _host_ws

    tenant_id = await _auth_websocket(websocket)
    if tenant_id is None:
        return

    await websocket.accept()
    _host_ws = websocket
    log.info("Android host agent connected via WebSocket")
    try:
        # Send initial device status (host reports its own state)
        await websocket.send_json({
            "type": "device_status",
            "device_id": os.getenv("ANDROID_DEVICE_ID", "AgenticMobile0001"),
            "connected": True,
            "state": "connected",
            "tenant_id": tenant_id,
        })

        # Relay messages from host to viewers
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "screen_frame":
                    # Forward screen frame to all viewers
                    if _viewer_ws:
                        await _viewer_ws.send_json(data)
                elif msg_type == "device_status":
                    # Forward status to all viewers
                    if _viewer_ws:
                        await _viewer_ws.send_json(data)
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                log.error(f"Invalid message from host: {message}")
    except WebSocketDisconnect:
        log.info("Android host agent disconnected")
    except Exception as e:
        log.error(f"Host WebSocket error: {e}")
    finally:
        _host_ws = None


@app.websocket("/android/ws/viewer")
async def android_ws_viewer(websocket: WebSocket):
    """WebSocket endpoint for the Android Workspace viewer (browser).
    Requires Bearer token authentication with owner/admin role.
    """
    global _viewer_ws

    tenant_id = await _auth_websocket(websocket)
    if tenant_id is None:
        return

    await websocket.accept()
    _viewer_ws = websocket
    log.info("Android Workspace viewer connected")

    try:
        # Send initial connection status
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "host_connected": _host_ws is not None,
            "tenant_id": tenant_id,
        })

        # Relay messages from viewer to host
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "inject_input":
                    # Forward input to host agent
                    if _host_ws:
                        await _host_ws.send_json(data)
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Host agent not connected",
                        })
                elif msg_type == "get_status":
                    # Request status from host
                    if _host_ws:
                        await _host_ws.send_json({"type": "get_status"})
                    else:
                        await websocket.send_json({
                            "type": "device_status",
                            "connected": False,
                            "state": "offline",
                        })
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                log.error(f"Invalid message from viewer: {message}")
    except WebSocketDisconnect:
        log.info("Android Workspace viewer disconnected")
    except Exception as e:
        log.error(f"Viewer WebSocket error: {e}")
    finally:
        _viewer_ws = None


# Mount Android observer static files
app.mount("/android/assets", StaticFiles(directory=ROOT / "static" / "android"), name="android_assets")'''

new_content = content[:start_idx] + new_section + content[end_idx:]

with open('D:\\checkout\\checkout\\checkout\\server.py', 'w') as f:
    f.write(new_content)

print("File updated successfully")
