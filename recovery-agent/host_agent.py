"""
Agentic Pay - Android Workspace Host Agent

Runs on the Windows host machine alongside the Android emulator.
Responsibilities:
1. Manage the Android emulator (start/stop/restart/status)
2. Run scrcpy to capture the screen
3. Bridge scrcpy's screen stream to the Agentic Pay SaaS via WebSocket
4. Receive control input from SaaS and inject via adb
5. Report device health (boot status, battery, storage, network)
"""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import signal
import subprocess
import sys
import time
import uuid
import websockets
from pathlib import Path

# Configuration
ANDROID_HOME = os.getenv("ANDROID_HOME", r"D:\Android\Sdk")
ANDROID_AVD_HOME = os.getenv("ANDROID_AVD_HOME", r"D:\Agentic-Android\AVD")
AVD_NAME = os.getenv("AVD_NAME", "AgenticMobile0001")
SCRCPY_PATH = os.getenv("SCRCPY_PATH", r"D:\checkout\checkout\scrcpy\scrcpy-win64-v2.5\scrcpy.exe")
ADB_PATH = os.path.join(ANDROID_HOME, "platform-tools", "adb.exe")
EMULATOR_PATH = os.path.join(ANDROID_HOME, "emulator", "emulator.exe")
FFMPEG_PATH = os.getenv("FFMPEG_PATH", r"D:\checkout\checkout\ffmpeg\ffmpeg-9.1-essentials_build\bin\ffmpeg.exe")
SAAS_URL = os.getenv("SAAS_URL", "wss://agenticpay.thenitishkr.in")
API_KEY = os.getenv("ANDROID_API_KEY", "")
DEVICE_ID = os.getenv("ANDROID_DEVICE_ID", "AgenticMobile0001")
TENANT_ID = os.getenv("ANDROID_TENANT_ID", "shop-0001")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("android_host")

class EmulatorManager:
    """Manages the Android emulator lifecycle."""

    def __init__(self):
        self.emulator_proc = None
        self.scrcpy_proc = None
        self.ffmpeg_proc = None
        self.ws_proc = None

    def is_emulator_running(self) -> bool:
        """Check if the emulator is running and responsive via ADB."""
        try:
            result = subprocess.run(
                [ADB_PATH, "devices"],
                capture_output=True, text=True, timeout=10
            )
            return "emulator-5554" in result.stdout and "device" in result.stdout
        except Exception as e:
            log.error(f"Failed to check emulator status: {e}")
            return False

    def start_emulator(self) -> bool:
        """Start the Android emulator."""
        if self.is_emulator_running():
            log.info("Emulator already running")
            return True

        log.info(f"Starting emulator {AVD_NAME}...")
        self.emulator_proc = subprocess.Popen(
            [
                EMULATOR_PATH,
                "-avd", AVD_NAME,
                "-no-snapshot", "-wipe-data",
                "-no-boot-anim",
                "-gpu", "host",
                "-accel", "on",
            ],
            cwd=os.path.dirname(EMULATOR_PATH),
        )

        # Wait for boot
        for i in range(60):  # Wait up to 5 minutes
            time.sleep(5)
            if self.is_emulator_running():
                log.info("Emulator is running")
                return True
            log.info(f"Waiting for emulator boot... ({i * 5}s)")

        log.error("Emulator failed to boot within 5 minutes")
        return False

    def stop_emulator(self):
        """Stop the emulator."""
        if self.emulator_proc:
            self.emulator_proc.terminate()
            try:
                self.emulator_proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.emulator_proc.kill()
            self.emulator_proc = None

        # Also kill via adb
        try:
            subprocess.run(
                [ADB_PATH, "emu", "kill"],
                capture_output=True, timeout=10
            )
        except Exception:
            pass

    def restart_emulator(self) -> bool:
        """Restart the emulator."""
        self.stop_emulator()
        return self.start_emulator()

    def get_device_status(self) -> dict:
        """Get device status information."""
        if not self.is_emulator_running():
            return {"connected": False, "state": "offline"}

        try:
            # Get boot status
            boot = subprocess.run(
                [ADB_PATH, "shell", "getprop", "sys.boot_completed"],
                capture_output=True, text=True, timeout=10
            )
            boot_completed = boot.stdout.strip() == "1"

            # Get battery level
            batt = subprocess.run(
                [ADB_PATH, "shell", "dumpsys", "battery"],
                capture_output=True, text=True, timeout=10
            )
            battery_level = None
            for line in batt.stdout.splitlines():
                if "level" in line:
                    battery_level = int(line.split(":")[1].strip())
                    break

            # Get storage
            storage = subprocess.run(
                [ADB_PATH, "shell", "df", "/data"],
                capture_output=True, text=True, timeout=10
            )

            return {
                "connected": True,
                "state": "booted" if boot_completed else "booting",
                "battery_level": battery_level,
                "storage_info": storage.stdout.strip()[:200] if storage.stdout else "unknown",
            }
        except Exception as e:
            log.error(f"Failed to get device status: {e}")
            return {"connected": False, "state": "error", "error": str(e)}

    def start_scrcpy(self) -> bool:
        """Start scrcpy to capture the emulator screen."""
        if self.scrcpy_proc:
            log.warning("scrcpy already running")
            return True

        log.info("Starting scrcpy screen capture...")
        self.scrcpy_proc = subprocess.Popen(
            [
                SCRCPY_PATH,
                "-s", "emulator-5554",
                "-m", "1024",
                "-b", "4M",
                "--max-fps", "15",
                "--no-audio",
                "--no-control",
                "--record", "-",
                "--format", "mkv",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        return True

    def stop_scrcpy(self):
        """Stop scrcpy."""
        if self.scrcpy_proc:
            self.scrcpy_proc.terminate()
            try:
                self.scrcpy_proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.scrcpy_proc.kill()
            self.scrcpy_proc = None

    def inject_input(self, action: str, **kwargs):
        """Inject input into the emulator via adb."""
        try:
            if action == "tap":
                x, y = kwargs["x"], kwargs["y"]
                subprocess.run(
                    [ADB_PATH, "shell", "input", "tap", str(x), str(y)],
                    capture_output=True, timeout=5
                )
            elif action == "swipe":
                x1, y1, x2, y2 = kwargs["x1"], kwargs["y1"], kwargs["x2"], kwargs["y2"]
                duration = kwargs.get("duration", 300)
                subprocess.run(
                    [ADB_PATH, "shell", "input", "swipe",
                     str(x1), str(y1), str(x2), str(y2), str(duration)],
                    capture_output=True, timeout=5
                )
            elif action == "key":
                keycode = kwargs["keycode"]
                subprocess.run(
                    [ADB_PATH, "shell", "input", "keyevent", str(keycode)],
                    capture_output=True, timeout=5
                )
            elif action == "text":
                text = kwargs["text"]
                subprocess.run(
                    [ADB_PATH, "shell", "input", "text", text],
                    capture_output=True, timeout=5
                )
            elif action == "back":
                subprocess.run(
                    [ADB_PATH, "shell", "input", "keyevent", "KEYCODE_BACK"],
                    capture_output=True, timeout=5
                )
            elif action == "home":
                subprocess.run(
                    [ADB_PATH, "shell", "input", "keyevent", "KEYCODE_HOME"],
                    capture_output=True, timeout=5
                )
            elif action == "recent":
                subprocess.run(
                    [ADB_PATH, "shell", "input", "keyevent", "KEYCODE_APP_SWITCH"],
                    capture_output=True, timeout=5
                )
        except Exception as e:
            log.error(f"Failed to inject input {action}: {e}")

manager = EmulatorManager()


def build_screen_message(frame_data: bytes) -> str:
    """Build a WebSocket message containing a screen frame."""
    return json.dumps({
        "type": "screen_frame",
        "data": base64.b64encode(frame_data).decode("ascii"),
        "timestamp": int(time.time() * 1000),
    })


def build_status_message(status: dict) -> str:
    """Build a WebSocket message containing device status."""
    return json.dumps({
        "type": "device_status",
        "device_id": DEVICE_ID,
        "timestamp": int(time.time() * 1000),
        **status,
    })


async def screen_stream_handler(websocket):
    """Handle WebSocket connections for screen streaming."""
    log.info("Screen stream client connected")

    # Send initial device status
    status = manager.get_device_status()
    await websocket.send(build_status_message(status))

    # Start scrcpy if not running
    if not manager.scrcpy_proc:
        manager.start_scrcpy()

    try:
        # Read scrcpy output and forward via WebSocket
        # scrcpy outputs MKV to stdout when using --record -
        # We read chunks and forward them
        while True:
            if manager.scrcpy_proc and manager.scrcpy_proc.stdout:
                chunk = manager.scrcpy_proc.stdout.read(4096)
                if chunk:
                    await websocket.send(build_screen_message(chunk))
                else:
                    await asyncio.sleep(0.01)
            else:
                await asyncio.sleep(0.1)
    except websockets.exceptions.ConnectionClosed:
        log.info("Screen stream client disconnected")
    except Exception as e:
        log.error(f"Screen stream error: {e}")
    finally:
        # Don't stop scrcpy on client disconnect - keep it running
        pass


async def control_handler(websocket):
    """Handle WebSocket connections for control input."""
    log.info("Control client connected")

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                if action:
                    manager.inject_input(action, **{
                        k: v for k, v in data.items()
                        if k not in ("action", "timestamp")
                    })
                    log.debug(f"Injected input: {action}")
            except json.JSONDecodeError:
                log.error(f"Invalid control message: {message}")
            except Exception as e:
                log.error(f"Failed to process control input: {e}")
    except websockets.exceptions.ConnectionClosed:
        log.info("Control client disconnected")


async def status_handler(websocket):
    """Handle WebSocket connections for device status polling."""
    log.info("Status client connected")

    try:
        while True:
            status = manager.get_device_status()
            await websocket.send(build_status_message(status))
            await asyncio.sleep(5)
    except websockets.exceptions.ConnectionClosed:
        log.info("Status client disconnected")


async def host_agent_handler(websocket):
    """Main WebSocket handler - routes to sub-handlers based on path."""
    path = websocket.request.path

    if path == "/android/stream":
        await screen_stream_handler(websocket)
    elif path == "/android/control":
        await control_handler(websocket)
    elif path == "/android/status":
        await status_handler(websocket)
    else:
        log.warning(f"Unknown WebSocket path: {path}")


async def main():
    """Main entry point for the host agent."""
    log.info("Starting Android Host Agent...")
    log.info(f"SAAS_URL: {SAAS_URL}")
    log.info(f"Device ID: {DEVICE_ID}")
    log.info(f"Tenant ID: {TENANT_ID}")

    # Start emulator
    if not manager.start_emulator():
        log.error("Failed to start emulator. Host agent will continue but device will be offline.")

    # Connect to SaaS via WebSocket
    headers = {}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    headers["X-Device-ID"] = DEVICE_ID
    headers["X-Tenant-ID"] = TENANT_ID

    async with websockets.connect(
        f"{SAAS_URL}/android/ws",
        additional_headers=headers,
    ) as ws:
        log.info("Connected to SaaS WebSocket")

        # Send device status
        status = manager.get_device_status()
        await ws.send(build_status_message(status))

        # Handle incoming messages
        async for message in ws:
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "start_emulator":
                    success = manager.start_emulator()
                    await ws.send(json.dumps({
                        "type": "emulator_started",
                        "success": success,
                    }))
                elif msg_type == "stop_emulator":
                    manager.stop_emulator()
                    await ws.send(json.dumps({
                        "type": "emulator_stopped",
                    }))
                elif msg_type == "restart_emulator":
                    success = manager.restart_emulator()
                    await ws.send(json.dumps({
                        "type": "emulator_restarted",
                        "success": success,
                    }))
                elif msg_type == "get_status":
                    status = manager.get_device_status()
                    await ws.send(build_status_message(status))
                elif msg_type == "inject_input":
                    manager.inject_input(data.get("action"), **{
                        k: v for k, v in data.items()
                        if k not in ("type", "action", "timestamp")
                    }))
                elif msg_type == "ping":
                    await ws.send(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                log.error(f"Invalid message from SaaS: {message}")
            except Exception as e:
                log.error(f"Error handling SaaS message: {e}")

if __name__ == "__main__":
    asyncio.run(main())