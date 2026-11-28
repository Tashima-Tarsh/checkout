#!/usr/bin/env bash
set -euo pipefail
pkg=com.agentic.pay.connectivitytest
trap 'adb logcat -b crash -d > startup-logcat.txt || true' EXIT
adb install -r -t recovery-agent/android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -b crash -c
adb shell pm path "$pkg"
user_id=$(adb shell am get-current-user | tr -d "\r")
# Resolve the launcher as the package manager does, without the DEFAULT-only
# implicit activity-start filter. Then launch the resolved component.
resolved=$(adb shell cmd package resolve-activity --brief --user "$user_id" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p "$pkg" | tr -d "\r" | tail -n 1)
printf "Resolved launcher: %s
" "$resolved"
case "$resolved" in
  "$pkg/.MainActivity"|"$pkg/$pkg.MainActivity") ;;
  *) adb shell dumpsys package "$pkg"; exit 1 ;;
esac
launch() {
  adb shell am start -W --user "$user_id" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$resolved" | tee /tmp/launch.txt
  grep -q 'Status: ok' /tmp/launch.txt
  sleep 5
  adb shell pidof "$pkg"
  adb shell dumpsys activity activities | grep -E 'mResumedActivity.*com\.agentic\.pay\.connectivitytest/(com\.agentic\.pay\.connectivitytest)?\.MainActivity'
  adb shell uiautomator dump /sdcard/agentic-ui.xml
  adb pull /sdcard/agentic-ui.xml /tmp/agentic-ui.xml
  grep -qi 'Enroll Device' /tmp/agentic-ui.xml || { cat /tmp/agentic-ui.xml; exit 1; }
  ! grep -qi 'Application Error' /tmp/agentic-ui.xml
}
launch
coords=$(python - <<'PY'
import xml.etree.ElementTree as ET
import re
for n in ET.parse('/tmp/agentic-ui.xml').iter('node'):
    if 'enroll device' in n.get('text','').lower():
        x,y,X,Y=map(int,re.findall(r'\d+',n.get('bounds')))
        print((x+X)//2,(y+Y)//2)
        break
else:
    raise SystemExit('Enrollment button missing')
PY
)
adb shell input tap $coords
sleep 3
adb shell dumpsys activity activities | grep -E 'mResumedActivity.*com\.agentic\.pay\.connectivitytest/(com\.agentic\.pay\.connectivitytest)?\.PairingActivity'
adb shell uiautomator dump /sdcard/agentic-ui.xml
adb pull /sdcard/agentic-ui.xml /tmp/agentic-ui.xml
grep -qi 'Pair Device' /tmp/agentic-ui.xml || { cat /tmp/agentic-ui.xml; exit 1; }
adb shell am force-stop "$pkg"
launch
adb logcat -b crash -d > startup-logcat.txt
if grep -q 'FATAL EXCEPTION' startup-logcat.txt; then
  cat startup-logcat.txt
  exit 1
fi
