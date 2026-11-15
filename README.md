# Office HQ

A rooted PF1007L Android photo frame turned into a wall dashboard for Home Assistant, built on
[wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard).

- **Today**: clock, weather, outside vs inside air (e.g. Apollo AIR-1), Hacker News top 10, a camera,
  room lights/fans/scenes/thermostat, and the next events from your Home Assistant calendars.
- **Calendar**: your Home Assistant calendars in a month grid or a week of day columns (switch, arrows or swipe).
- **News**: the whole Hacker News front page, by HN's own order, points or newest.
- **Chores**: a Home Assistant to-do list; tap an item to complete it.
- **Cameras**: snapshot grid; tap one for a live view.
- **Home**: locks and garage (with confirmation), thermostats, blinds, NAS and leak status.

It is plain HTML/CSS/JS loaded from the frame's own storage and talks to Home Assistant over one WebSocket,
so it renders in about 2 seconds on the frame's old WebView (Chromium 106).

## Set up

1. Root the frame and install the kiosk app by following the
   [upstream guides](https://github.com/wesbos/photo-frame-dashboard) (clone it into `photo-frame-dashboard/`).
2. Create a **non-admin** Home Assistant user for the frame, make a long-lived token for it, and save the token
   to `~/.config/hass-frame-token`.
3. `cp office/config.example.js office/config.js` and fill in your HA URL and entity ids.
4. Plug the frame in over USB and run `office/deploy.sh`.

If `adb devices` is empty while the frame is plugged in, run `adb kill-server` and try again.

## Layout

| Path | What |
| --- | --- |
| `office/` | The dashboard (what the frame shows), its config template and `deploy.sh` |
| `designs/tiles/` | An earlier pastel tile design (light/dark), kept for reference |
| `hass/` | Small Home Assistant / WebView helper scripts |
| `CLAUDE.md` | Architecture notes, device facts and gotchas |

## Security

Home Assistant has no per-entity permissions: the frame's token can call any service its user can, including
unlocking doors. Anyone with physical USB access to the frame can read it. Use a dedicated non-admin user.

## License

MIT (see `LICENSE`). The bundled fonts (Archivo, Instrument Serif) are under the SIL Open Font License 1.1;
see the `*-OFL.txt` files next to them.
