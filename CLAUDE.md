# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Office dashboard on a rooted PF1007L photo frame

A cheap Android photo frame, rooted and turned into an office wall display that shows **Office HQ**,
a lightweight Home Assistant front end. Built by following
[wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard).

Owner-specific facts (network, hostnames, entity choices, the frame's change log, status) live in the git-ignored
`CLAUDE.local.md`, which Claude Code also loads. Keep anything personal there, never in tracked files.

## Layout

| Path | What |
| --- | --- |
| `office/` | **Office HQ**, the dashboard the frame shows. Plain HTML/CSS/JS, no build step |
| `office/config.example.js` | Template for `office/config.js` (git-ignored): HA URL, entities, names, cameras, dim hours |
| `office/ha.js` | Minimal HA WebSocket client (auth, `subscribe_entities`, calls, subscriptions) |
| `office/app.js` | Views: Today (Home HQ layout), Calendar (month / week), News (HN front page), Chores (to-do list), Cameras, Home. Time-of-day accent follows `sun.sun`. Confirm dialog before unlock / garage open |
| `office/deploy.sh` | Pushes `office/` to the frame, writes `secrets.js` from the token file, restarts the kiosk |
| `designs/tiles/` | Earlier pastel tile design (light/dark), kept for reference; see its README |
| `hass/ha-ws.mjs` | Node HA WebSocket CLI using an **admin** token (`~/.config/hass-token`); URL from `$HASS_URL` or `office/config.js` |
| `hass/cdp.mjs` | Chrome DevTools helper for the frame's WebView (eval / reload + console capture) |
| `photo-frame-dashboard/` | Git-ignored clone of the upstream repo: rooting scripts, kiosk APK source, private backups |

Git-ignored and private: `office/config.js`, `designs/tiles/config.js`, any `secrets.js`, `CLAUDE.local.md`,
`hass/office-kiosk*.json`, and all of `photo-frame-dashboard/` (its `backups/` and `diagnostics/` hold a full eMMC
image with Wi-Fi credentials and device identifiers).

## How Office HQ fits together

- `index.html` loads plain scripts in order: `secrets.js` (`window.HA_TOKEN`) → `config.js`
  (`window.DASHBOARD_CONFIG`) → `ha.js` (`window.HA`) → `app.js` (one IIFE). No modules, no bundler, no tests or
  linter. Check syntax with `node --check office/app.js`, then preview in a browser and on the frame.
- `ha.js` keeps one socket and a merged `ha.states` map. `subscribe_entities` covers only the ids that
  `watched()` in `app.js` collects from the config. **A new config key or entity list must also be added to
  `watched()`**, or its state never arrives. Add new keys to `config.example.js` too.
- `app.js` pattern per view: `build*()` writes the static DOM once; `render*()` redraws from `ha.states` on every
  `ha.onState` (some only when their entity is in `changed`); `load*()` fetches non-entity data (HA history,
  to-do items, snapshots, Hacker News, Open-Meteo). `tick()` runs every second and schedules the periodic loads
  (news, outside air and the calendar every 10 min) and a full reload at 03:00.
- Clicks use one delegated listener per view, keyed on `data-*` attributes. Service calls go through `act()`,
  which toasts failures. Dangerous actions are wrapped in `confirmThen()`.
- Code style is ES5-ish (`var`, `function`, string-built HTML through `esc()`) to stay safe on WebView 106.

## Dashboard notes

- Today follows the upstream **Home HQ** layout (paper + ink): header = clock · weather (now, summary, 6 hours) ·
  **air** (outside US AQI from Open-Meteo vs inside AQI computed from an indoor monitor's PM2.5 with EPA 2024
  breakpoints, plus CO₂ / VOC index / NOx index / humidity with research-based bands, see `app.js`); middle = Hacker
  News top 10 (see News below) · a camera; bottom = room controls · **up next** (the next
  events from `calendars` via `calendar.get_events` with `return_response` over the socket; HA expands
  repeats and timezones, so an ICS feed goes in as a Remote Calendar rather than being parsed on the frame. The big
  slot is the next timed or future event; an all-day event already under way drops to the list).
- **Calendar** view: every `calendars` entry, colour-coded. A Month / Week switch (sliding pill, remembered in
  localStorage), ‹ Today › and swipe to page. Tap a day in the month to open its week. It fetches only the range on
  screen. Multi-day events show their title on the first day (and Sundays) and a bar or "Continues" after that.
  Up next's "Calendar ›" opens this month; tapping one of its events opens that week.
- **News**: Algolia's `front_page` search (30 stories, one request) is sorted by *points*, not HN's order, so
  `newsRankUrl` (HN Firebase `topstories.json`, GTS Root R1 cross-signed by GlobalSign like Algolia) supplies the
  real rank. The News view's Front page / Points / Newest switch also orders the Today card (localStorage). Job
  posts have no points or comments.
- Apollo AIR-1 caveats: VOC/NOx are Sensirion *indices* (VOC 100 = room's recent average; NOx baseline 1), not ppm;
  the MiCS gas readings are presence-only; the AIR-1 temperature reads high from board heat, so room temperature and
  humidity come from a separate sensor.
- **Colour layer** (paper + ink base): the news tile uses Hacker News colours (#FF6600 bar, #F6F6EF page);
  air numbers and bars use EPA AQI colours, metric values are tinted by level; room tiles take a light's real
  `rgb_color` when on, running fans go blue, thermostat targets turn blue/orange while cooling/heating; header rules,
  AM/PM and the active rail tab follow `sun.sun` elevation (`sky-sunrise` coral, `sky-day` blue, `sky-sunset`
  violet, `sky-night` indigo); weather icons are coloured by condition.
- Camera snapshots request `&width=<snapshotWidth>` and back off on failure (some cameras' snapshots are slow or
  fail inside HA itself).
- Preview on the Mac: write a local `office/secrets.js` from `~/.config/hass-frame-token`, run
  `python3 -m http.server 8099` in `office/`, open `http://127.0.0.1:8099/?theme=light` (or `dark`) at 1280×800.
  Delete `office/secrets.js` afterwards; `deploy.sh` generates its own. Python's server lets the browser cache
  JS, so force-refresh after edits.
- HA entity ids change when integrations are cleaned up. Validate every configured entity before deploying
  (command below).

## Common tasks

```sh
# First time: create your config from the template
cp office/config.example.js office/config.js && $EDITOR office/config.js

# Change the dashboard (frame on USB), then check it:
office/deploy.sh
adb -d exec-out screencap -p > /tmp/frame.png        # then view the PNG

# Tap the frame (rail: Today 37,44 · Calendar 37,116 · News 37,188 · Chores 37,260 · Cameras 37,332 · Home 37,404):
adb -d shell input tap 37 188

# Rebuild the kiosk APK (JDK 17 + Android SDK from Homebrew):
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
photo-frame-dashboard/dashboard/kiosk/build.sh && adb -d install -r photo-frame-dashboard/dashboard/kiosk/build/homehq.apk

# Query or change HA (admin token):
node hass/ha-ws.mjs '{"type":"lovelace/dashboards/list"}'

# Validate every entity id in config.js against HA (read-only; run before deploying):
node hass/ha-ws.mjs '{"type":"get_states"}' | node -e '
const f=require("fs"),w={};new Function("window",f.readFileSync("office/config.js","utf8"))(w);
const have=new Set(JSON.parse(f.readFileSync(0)).map(s=>s.entity_id));
const ids=[...new Set(JSON.stringify(w.DASHBOARD_CONFIG).match(/"[a-z_]+\.[a-z0-9_]+"/g).map(JSON.parse))].filter(i=>!i.startsWith("hn."));
console.log(ids.length,"checked; missing:",ids.filter(i=>!have.has(i)))'
```

### Debugging the frame's WebView

```sh
adb -d shell am start -n com.wesbos.homehq/.Home --ez debug true      # enable remote debugging
adb -d shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | sort -u
adb -d forward tcp:9222 localabstract:webview_devtools_remote_<pid>
curl -s http://127.0.0.1:9222/json                                   # get the page's ws URL
node hass/cdp.mjs <ws-url> 'eval:document.title'                     # or: node hass/cdp.mjs <ws-url> reload
adb -d forward --remove-all; adb -d shell am start -n com.wesbos.homehq/.Home --ez debug false
```

## The frame (PF1007L)

- **PF1007L / AiMOR**, Allwinner A33, Android 6.0.1, 1280×800 at density 160.
- **USB:** on this unit the only working data path was a USB-A→C data cable through a USB-C adapter on a Mac
  port; dock ports and USB-C→C did not enumerate. Stock shows `1f3a:1000`; patched shows `1f3a:1002`.
- **Root ADB over USB** (`adb -d`), no key needed. There is no network ADB.
- `adb reboot` works. Boot to `sys.boot_completed=1` takes about 35 s.
- To change `/system`: `mount -o remount,rw /system`, write, check by reading back, `sync`, `mount -o remount,ro /system`.
- The 2016 trust store lacks ISRG Root X1 (Let's Encrypt) and Google's GTS roots, so Google-hosted HTTPS (for
  example Google Fonts) fails. Office HQ bundles its fonts in `office/fonts/` for this reason. Hacker News via
  Algolia works because GTS Root R1 is cross-signed by GlobalSign Root CA (`b0f3e76e.0`, valid until 2028).

### Kiosk gotchas

- The kiosk runs as the **`.Home` alias**. Send intents to `com.wesbos.homehq/.Home`;
  intents to `.MainActivity` are swallowed while Home is running.
- `--es url <http(s) url>` saves a URL that overrides `DEFAULT_URL`. It refuses `file:` URLs.
  To go back to the local page, delete `/data/data/com.wesbos.homehq/shared_prefs/kiosk.xml`
  (force-stop first). `deploy.sh` does not do this.
- `am force-stop` makes Android relaunch the kiosk as Home right away. After DNS or hosts changes,
  force-stop the kiosk to clear Chromium's DNS cache.
- WebView 106 lacks `oklch()`, `color-mix()`, CSS nesting, `:has()` and `dvh`, and rejects 4- and 8-digit hex colours.
  Write ES2020 JS with no build step. `file://` pages can't `fetch()` local files: load data as `<script>`.
- HA's own frontend works on WebView 106 (legacy build) but takes about 2 minutes to render on the A33.
  Office HQ renders in about 2 s.

### ADB gotcha

- If `adb devices` is empty while USB shows `1f3a:1002` (check `ioreg -p IOUSB -l -w0 | grep -c '"idVendor" = 7994'`),
  run `adb kill-server; adb start-server`.

## Security model

- The frame gets a token for a **non-admin** HA user (`~/.config/hass-frame-token`); `hass/ha-ws.mjs` uses a separate
  admin token (`~/.config/hass-token`). HA has no per-entity permissions, so the frame's token can still unlock doors
  and open the garage through the API, and anyone with physical USB access to the frame can read it.

## Working rules for this project

- **Show the exact change and get the owner's approval before every write to the frame**
  (`/system`, boot partition, packages, settings) and to HA config. Back up first and read back after.
- `sudo` needs the owner's password: give them the command to run in their terminal.
- Don't press real-device controls (locks, garage, lights, thermostats) to "test" without asking.
- Upstream guides: `photo-frame-dashboard/docs/pf1007l-start-here.md`, `allwinner-a33-mainline-uboot.md`,
  `allwinner-a33-pf1007l.md`, `pf1007l-boot-fixes.md`. Never edit a hash, size or sector guard in their scripts.
