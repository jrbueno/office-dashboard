#!/usr/bin/env bash
# Push Office HQ into the kiosk's private files folder on the frame, then restart the kiosk.
# Needs the frame on USB with root ADB. The Home Assistant token for the frame's own HA user
# is read from ~/.config/hass-frame-token (override with HASS_FRAME_TOKEN_FILE) and written
# only to the frame, as secrets.js.
#   office/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

PKG=com.wesbos.homehq
DEST=/data/data/$PKG/files/office
STAGE=/data/local/tmp/office-dashboard
TOKEN_FILE="${HASS_FRAME_TOKEN_FILE:-$HOME/.config/hass-frame-token}"
FILES=(index.html style.css fonts.css config.js ha.js app.js fonts/Archivo-normal.woff2
  fonts/InstrumentSerif-normal.woff2 fonts/InstrumentSerif-italic.woff2)

[ -r config.js ] || { echo "STOP: no config.js here (copy config.example.js and fill in your entities)"; exit 1; }
[ -r "$TOKEN_FILE" ] || { echo "STOP: $TOKEN_FILE not found (token for the frame's HA user)"; exit 1; }
[ "$(adb -d shell id -u | tr -d '\r')" = 0 ] || { echo "STOP: adb shell is not root"; exit 1; }
APP_UID=$(adb -d shell "stat -c %u /data/data/$PKG" | tr -d '\r')
[ -n "$APP_UID" ] && [ "$APP_UID" != 0 ] || { echo "STOP: $PKG is not installed"; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
printf 'window.HA_TOKEN = %s;\n' "$(python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1]).read().strip()))' "$TOKEN_FILE")" > "$TMP/secrets.js"

adb -d shell "rm -rf $STAGE && mkdir -p $STAGE/fonts"
for f in "${FILES[@]}"; do adb -d push -q "$f" "$STAGE/$f"; done
adb -d push -q "$TMP/secrets.js" "$STAGE/secrets.js"
adb -d shell "set -e; rm -rf $DEST; mkdir -p $DEST; cp -R $STAGE/* $DEST/; rm -rf $STAGE;
  chown -R $APP_UID:$APP_UID /data/data/$PKG/files; chmod -R u=rwX,go= /data/data/$PKG/files"

for f in "${FILES[@]}"; do
  adb -d exec-out "cat $DEST/$f" | cmp -s - "$f" || { echo "STOP: $f differs on the frame"; exit 1; }
done
adb -d exec-out "cat $DEST/secrets.js" | cmp -s - "$TMP/secrets.js" || { echo "STOP: secrets.js differs"; exit 1; }
echo "Deployed $(( ${#FILES[@]} + 1 )) files to $DEST"

# Restart the kiosk so it reloads from its default (local) URL.
adb -d shell "am force-stop $PKG; am start -a android.intent.action.MAIN -c android.intent.category.HOME" >/dev/null
echo "Kiosk restarted"
