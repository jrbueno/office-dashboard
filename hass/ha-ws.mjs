// Minimal Home Assistant WebSocket client: node hass/ha-ws.mjs '<json command>' ...
// Reads the token from ~/.config/hass-token. Prints each result as JSON.
// HA address: $HASS_URL, else haUrl from office/config.js.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
function haBase() {
  if (process.env.HASS_URL) return process.env.HASS_URL;
  const w = {};
  try {
    new Function('window', readFileSync(new globalThis.URL('../office/config.js', import.meta.url), 'utf8'))(w);
  } catch {
    console.error('Set HASS_URL or create office/config.js (see office/config.example.js)');
    process.exit(1);
  }
  return w.DASHBOARD_CONFIG.haUrl;
}
const URL = haBase().replace(/^http/, 'ws').replace(/\/(api\/websocket)?$/, '') + '/api/websocket';
const token = readFileSync(`${homedir()}/.config/hass-token`, 'utf8').trim();
const cmds = process.argv.slice(2).map((c) => JSON.parse(c));
const ws = new WebSocket(URL);
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: token }));
  else if (m.type === 'auth_invalid') { console.error('auth failed'); process.exit(1); }
  else if (m.type === 'auth_ok') run();
  else if (m.type === 'result') pending.get(m.id)?.(m);
};
ws.onerror = (e) => { console.error('ws error', e.message); process.exit(1); };
function send(cmd) {
  return new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ ...cmd, id: i })); });
}
async function run() {
  let failed = false;
  for (const c of cmds) {
    const r = await send(c);
    if (!r.success) failed = true;
    console.log(JSON.stringify(r.success ? r.result : { error: r.error }, null, 1));
  }
  // Let Node exit on its own once the socket closes, so piped stdout is fully flushed
  // (process.exit() here truncated piped output at 64 KB).
  process.exitCode = failed ? 1 : 0;
  ws.close();
}
