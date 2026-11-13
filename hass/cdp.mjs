// Tiny CDP helper for the frame's WebView: node hass/cdp.mjs <ws-url> <mode>
// mode "eval:<js>" evaluates; mode "reload" reloads and prints console/exception events for 25 s.
const [, , url, mode] = process.argv;
const ws = new WebSocket(url);
let id = 0;
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
ws.onopen = () => {
  if (mode.startsWith('eval:')) {
    send('Runtime.evaluate', { expression: mode.slice(5), returnByValue: true, awaitPromise: true });
  } else {
    send('Runtime.enable'); send('Log.enable'); send('Page.enable'); send('Page.reload', { ignoreCache: true });
    setTimeout(() => process.exit(0), 25000);
  }
};
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && m.result && m.result.result) { console.log(JSON.stringify(m.result.result.value, null, 1)); process.exit(0); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    console.log('EXCEPTION', (d.exception && d.exception.description || d.text).split('\n')[0], d.url || '', d.lineNumber);
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    console.log('CONSOLE', m.params.type, m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level !== 'verbose') {
    console.log('LOG', m.params.entry.level, m.params.entry.text.slice(0, 300), m.params.entry.url || '');
  }
};
