// Minimal Home Assistant WebSocket client for WebView 106 (no build step, no dependencies).
// One socket: auth, subscribe_entities for the configured entities, and request/response calls.
// Reconnects with backoff; listeners re-render from the merged state map.
(function () {
  'use strict';

  function HA(baseUrl, token) {
    this.url = baseUrl.replace(/^http/, 'ws') + '/api/websocket';
    this.base = baseUrl;
    this.token = token;
    this.states = {};
    this.connected = false;
    this._id = 0;
    this._pending = {};
    this._subs = {};
    this._listeners = [];
    this._statusListeners = [];
    this._entityIds = [];
    this._onReconnect = [];
    this._backoff = 1000;
  }

  HA.prototype.onState = function (fn) { this._listeners.push(fn); };
  HA.prototype.onStatus = function (fn) { this._statusListeners.push(fn); };
  HA.prototype.onConnect = function (fn) { this._onReconnect.push(fn); };

  HA.prototype._setStatus = function (ok, msg) {
    this.connected = ok;
    this._statusListeners.forEach(function (fn) { fn(ok, msg); });
  };

  HA.prototype.connect = function (entityIds) {
    var self = this;
    if (entityIds) this._entityIds = entityIds;
    var ws;
    try { ws = new WebSocket(this.url); } catch (e) { return this._retry('socket: ' + e.message); }
    this.ws = ws;
    ws.onmessage = function (ev) { self._handle(JSON.parse(ev.data)); };
    ws.onclose = function () { self._retry('disconnected'); };
    ws.onerror = function () { /* onclose follows */ };
  };

  HA.prototype._retry = function (why) {
    var self = this;
    if (this._retrying) return;
    this._retrying = true;
    this._setStatus(false, why);
    Object.keys(this._pending).forEach(function (k) { self._pending[k].reject(new Error('disconnected')); });
    this._pending = {};
    setTimeout(function () {
      self._retrying = false;
      self.connect();
    }, this._backoff);
    this._backoff = Math.min(this._backoff * 2, 30000);
  };

  HA.prototype._send = function (msg) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.ws || self.ws.readyState !== 1) return reject(new Error('not connected'));
      var id = ++self._id;
      msg.id = id;
      self._pending[id] = { resolve: resolve, reject: reject };
      self.ws.send(JSON.stringify(msg));
    });
  };

  HA.prototype.call = function (type, data) {
    var msg = { type: type };
    for (var k in data || {}) msg[k] = data[k];
    return this._send(msg);
  };

  HA.prototype.service = function (domain, service, data, target) {
    return this.call('call_service', { domain: domain, service: service, service_data: data || {}, target: target });
  };

  // Subscribe and route events to fn. Resolves once HA accepts the subscription.
  HA.prototype.subscribe = function (msg, fn) {
    var p = this._send(msg);
    // _send assigned msg.id; events can arrive right after the result, so register now.
    this._subs[msg.id] = fn;
    return p;
  };

  HA.prototype._handle = function (m) {
    var self = this;
    if (m.type === 'auth_required') {
      this.ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
    } else if (m.type === 'auth_invalid') {
      this._setStatus(false, 'token rejected');
      this.ws.onclose = null;
      this.ws.close();
    } else if (m.type === 'auth_ok') {
      this._backoff = 1000;
      this.states = {};
      var subId = ++this._id;
      this._subs[subId] = function (ev) { self._applyEntities(ev); };
      this.ws.send(JSON.stringify({ id: subId, type: 'subscribe_entities', entity_ids: this._entityIds }));
      this._setStatus(true);
      this._onReconnect.forEach(function (fn) { fn(); });
    } else if (m.type === 'result') {
      var p = this._pending[m.id];
      if (!p) return;
      delete this._pending[m.id];
      if (m.success) p.resolve(m.result); else p.reject(new Error(m.error && m.error.message || 'failed'));
    } else if (m.type === 'event') {
      var fn = this._subs[m.id];
      if (fn) fn(m.event);
    }
  };

  // subscribe_entities sends compressed states: a = added, c = changed (+/- diffs), r = removed.
  HA.prototype._applyEntities = function (ev) {
    var s = this.states;
    var changed = [];
    var id;
    if (ev.a) {
      for (id in ev.a) {
        s[id] = { state: ev.a[id].s, attributes: ev.a[id].a || {}, last_changed: ev.a[id].lc };
        changed.push(id);
      }
    }
    if (ev.c) {
      for (id in ev.c) {
        var cur = s[id];
        if (!cur) continue;
        var plus = ev.c[id]['+'];
        var minus = ev.c[id]['-'];
        if (plus) {
          if (plus.s !== undefined) cur.state = plus.s;
          if (plus.lc !== undefined) cur.last_changed = plus.lc;
          if (plus.a) for (var k in plus.a) cur.attributes[k] = plus.a[k];
        }
        if (minus && minus.a) minus.a.forEach(function (key) { delete cur.attributes[key]; });
        changed.push(id);
      }
    }
    if (ev.r) ev.r.forEach(function (rid) { delete s[rid]; changed.push(rid); });
    this._listeners.forEach(function (fn) { fn(changed); });
  };

  window.HA = HA;
})();
