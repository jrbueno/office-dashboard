// Office HQ: a light Home Assistant front end for a wall-mounted photo frame (Android WebView 106).
// Loads from the frame's own storage. Live data comes over one HA WebSocket (ha.js); news and
// outdoor air come straight from public APIs.
(function () {
  'use strict';

  var cfg = window.DASHBOARD_CONFIG;
  // ?theme=dark|light overrides the configured theme (handy for previews).
  var themeParam = /[?&]theme=(dark|light)/.exec(location.search);
  if (themeParam) cfg.theme = themeParam[1];
  var ha = new window.HA(cfg.haUrl, window.HA_TOKEN || '');
  var $ = function (id) { return document.getElementById(id); };
  var qs = function (sel) { return document.querySelector(sel); };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function st(id) { return ha.states[id]; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function round(v) { var n = parseFloat(v); return isNaN(n) ? '–' : Math.round(n); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function hour12(h) { return (h % 12) || 12; }
  function ampm(h) { return h < 12 ? 'am' : 'pm'; }

  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2200);
  }
  function act(domain, service, data, target, label) {
    return ha.service(domain, service, data, target).catch(function (e) {
      toast((label || service) + ' failed: ' + e.message);
    });
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ------------------------------------------------------------------ icons
  function svg(body, w) {
    return '<svg class="i" viewBox="0 0 24 24" width="' + (w || 24) + '" height="' + (w || 24) +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }
  var I = {
    cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    spark: svg('<path d="M12 3l1.8 5.6L19.5 10l-5.7 1.4L12 17l-1.8-5.6L4.5 10l5.7-1.4z"/>'),
    leaf: svg('<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19l8-8"/>'),
    cam: svg('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>'),
    bulb: svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>'),
    lamp: svg('<path d="M8 3h8l3 8H5z"/><path d="M12 11v8M8 21h8"/>'),
    fan: svg('<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7s3 4-2 7M14 12c4 0 7 1 7 4s-4 3-7-2M12 14c0 4-1 7-4 7s-3-4 2-7M10 12c-4 0-7-1-7-4s4-3 7 2"/>'),
    lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    unlock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>'),
    garage: svg('<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-9h10v9M7 15h10M7 18h10"/>'),
    thermo: svg('<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>'),
    blind: svg('<path d="M4 3h16M5 3v14M19 3v14M5 7h14M5 11h14M5 15h14M12 17v4"/>'),
    drive: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18M7 17h.01"/>'),
    drop: svg('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>')
  };

  // Decorative art drawn in SVG (no photos on the frame).
  function plantArt(dark) {
    var leaf = dark ? '#1C2A22' : '#4E8B5A';
    var leaf2 = dark ? '#16211B' : '#6FA77A';
    var pot = dark ? '#1A1C24' : '#E9E4F3';
    return '<svg class="c-art" viewBox="0 0 210 280">' +
      '<path d="M120 270h70l8-70h-86z" fill="' + pot + '"/>' +
      '<path d="M150 205C140 150 110 120 60 112c20 40 50 70 90 93z" fill="' + leaf2 + '"/>' +
      '<path d="M158 205c-4-60 10-110 46-150-4 60-18 110-46 150z" fill="' + leaf + '"/>' +
      '<path d="M152 205c-30-40-38-90-24-150 26 40 34 90 24 150z" fill="' + leaf2 + '"/>' +
      '<path d="M162 205c20-30 40-46 70-50-12 30-36 46-70 50z" fill="' + leaf + '"/>' +
      '<g stroke="' + (dark ? '#0F1612' : '#F1EEFB') + '" stroke-width="3" fill="none" opacity=".7">' +
      '<path d="M158 200c4-50 18-95 40-130M150 200c-14-40-18-80-14-130M146 200C120 170 96 140 72 120"/></g></svg>';
  }
  function sparkle(x, y, s) {
    return '<span class="sparkle" style="left:' + x + 'px;top:' + y + 'px"><svg width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c.6 6 5.4 11.4 12 12-6.6.6-11.4 5.4-12 12C11.4 17.4 6.6 12.6 0 12 6.6 11.4 11.4 6 12 0z"/></svg></span>';
  }
  function weatherArt(kind, dark) {
    var c1 = dark ? '#3A3F52' : '#C9CFDC';
    var c2 = dark ? '#262A38' : '#9AA3B6';
    var cloud = '<path d="M60 120h110a32 32 0 0 0 0-64 44 44 0 0 0-84-10 34 34 0 0 0-26 74z" fill="url(#wc)"/>';
    var defs = '<defs><linearGradient id="wc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c1 + '"/>' +
      '<stop offset="1" stop-color="' + c2 + '"/></linearGradient><radialGradient id="ws"><stop offset="0" stop-color="' +
      (dark ? '#F4EBD2' : '#FFC46B') + '"/><stop offset="1" stop-color="' + (dark ? '#F4EBD2' : '#FF9A3D') +
      '" stop-opacity="0"/></radialGradient></defs>';
    var body;
    if (kind === 'sun') body = '<circle cx="130" cy="70" r="70" fill="url(#ws)" opacity=".8"/><circle cx="130" cy="70" r="30" fill="' + (dark ? '#F4EBD2' : '#FF9A3D') + '"/>';
    else if (kind === 'moon') body = '<circle cx="130" cy="64" r="64" fill="url(#ws)" opacity=".35"/><path d="M140 30a36 36 0 1 0 26 60 30 30 0 0 1-26-60z" fill="#E9E2CC"/>';
    else if (kind === 'rain' || kind === 'storm') {
      body = cloud + '<g stroke="' + (dark ? '#59607A' : '#8C95AA') + '" stroke-width="3" stroke-linecap="round" opacity=".8">' +
        '<path d="M70 132l-8 18M92 132l-8 18M114 132l-8 18M136 132l-8 18M158 132l-8 18"/></g>';
    } else if (kind === 'part') body = '<circle cx="150" cy="50" r="28" fill="' + (dark ? '#E9E2CC' : '#FF9A3D') + '"/>' + cloud;
    else body = cloud;
    return '<svg class="w-art" viewBox="0 0 210 160">' + defs + body + '</svg>';
  }

  var COND = {
    'clear-night': ['Clear', 'moon'], sunny: ['Sunny', 'sun'], partlycloudy: ['Partly cloudy', 'part'],
    cloudy: ['Cloudy', 'cloud'], fog: ['Fog', 'cloud'], rainy: ['Rain', 'rain'], pouring: ['Pouring', 'rain'],
    snowy: ['Snow', 'rain'], 'snowy-rainy': ['Sleet', 'rain'], hail: ['Hail', 'rain'],
    lightning: ['Lightning', 'storm'], 'lightning-rainy': ['Storms', 'storm'],
    windy: ['Windy', 'cloud'], 'windy-variant': ['Windy', 'cloud'], exceptional: ['Alert', 'storm']
  };
  function cond(c) { return COND[c] || [cap(c) || '—', 'cloud']; }
  var WET = { rainy: 1, pouring: 1, 'lightning-rainy': 1, snowy: 1, 'snowy-rainy': 1, hail: 1 };

  // ------------------------------------------------------------------ theme + views
  var dark = null;
  function applyTheme() {
    var sun = st('sun.sun');
    var h = new Date().getHours();
    var want = cfg.theme === 'dark' ? true : cfg.theme === 'light' ? false
      : (sun ? sun.state === 'below_horizon' : (h < 7 || h >= 19));
    if (want === dark) return;
    dark = want;
    $('stage').className = 'stage ' + (dark ? 'theme-dark' : 'theme-light');
    renderClockArt();
    renderWeather();
  }

  var current = 'today';
  function go(view) {
    current = view;
    var items = document.querySelectorAll('.rail-item');
    for (var i = 0; i < items.length; i++) items[i].className = 'rail-item' + (items[i].getAttribute('data-go') === view ? ' is-active' : '');
    var views = document.querySelectorAll('.view');
    for (var j = 0; j < views.length; j++) views[j].className = 'view' + (views[j].id === 'view-' + view ? ' is-active' : '');
    if (view === 'chores') loadTodo();
    refreshSnapshots(true);
  }
  $('rail').addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (b) go(b.getAttribute('data-go'));
  });

  // ------------------------------------------------------------------ today
  function buildToday() {
    var r = cfg.room;
    var tiles = r.tiles.map(function (t) {
      return '<button class="r-tile" data-toggle="' + t.entity + '">' + (I[t.icon] || I.bulb) +
        '<div><div class="n">' + esc(t.name) + '</div><div class="s" data-sub="' + t.entity + '">–</div></div></button>';
    }).join('');
    var scenes = r.scenes.map(function (s, i) {
      return '<button class="pill" data-scene="' + i + '">' + esc(s.name) + '</button>';
    }).join('');
    var th = r.thermostat;
    $('view-today').innerHTML =
      '<div class="today">' +
        '<div class="tile t-clock">' +
          '<span class="chip"><span class="ico">' + I.cal + '</span><span id="cDate"></span></span>' +
          '<div id="cArt"></div>' + sparkle(392, 40, 26) + sparkle(352, 104, 14) +
          '<div class="c-time serif tnum" id="cTime"></div>' +
          '<div class="c-greet" id="cGreet"></div>' +
        '</div>' +
        '<div class="tile t-news"><div class="n-head" id="nHead"></div><div id="nBody"><div class="n-empty">Loading headlines…</div></div></div>' +
        '<div class="tile t-wx" id="tWx"></div>' +
        '<div class="tile t-room">' +
          '<div class="r-top"><div class="r-title">' + esc(r.name) + '</div><div class="r-stats" id="rStats"></div></div>' +
          '<div class="r-grid">' + tiles + '</div>' +
          '<div class="r-row">' + scenes + '</div>' +
          (th ? '<div class="r-thermo" data-thermo="' + th.entity + '"><div class="n">' + esc(th.name) +
            '<span data-mode="' + th.entity + '">–</span></div>' +
            '<button class="round" data-step="-1">–</button><span class="v serif tnum" data-target="' + th.entity + '">–</span>' +
            '<button class="round" data-step="1">+</button></div>' : '') +
        '</div>' +
        '<button class="tile t-cam" data-cam="' + cfg.todayCamera + '">' +
          '<img data-snap="' + cfg.todayCamera + '" alt="">' +
          '<span class="chip"><span class="ico">' + I.cam + '</span>' + esc(camName(cfg.todayCamera)) + '</span>' +
          '<span class="cam-age" data-age="' + cfg.todayCamera + '"></span>' +
        '</button>' +
        '<div class="tile t-air" id="tAir"></div>' +
      '</div>';
  }

  function renderClockArt() {
    if ($('cArt')) $('cArt').innerHTML = plantArt(dark);
  }

  function tickClock(now) {
    var h = now.getHours();
    $('cDate').textContent = DAYS[now.getDay()] + ' · ' + now.getDate() + ' ' + MONTHS[now.getMonth()];
    $('cTime').innerHTML = (cfg.clock24h ? pad(h) : hour12(h)) + ':' + pad(now.getMinutes()) +
      (cfg.clock24h ? '' : '<em>' + ampm(h) + '</em>');
    var greet = h < 5 ? 'Good night.' : h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : h < 22 ? 'Good evening,' : 'Good night.';
    var html = '<b>' + greet + '</b>Here’s your day.';
    if ($('cGreet').innerHTML !== html) $('cGreet').innerHTML = html;
  }

  // ---- news
  var news = [];
  function loadNews() {
    if (!cfg.newsUrl) return;
    getJSON(cfg.newsUrl).then(function (j) {
      news = (j.hits || []).slice(0, 3);
      renderNews();
    }).catch(function (e) {
      if (!news.length) $('nBody').innerHTML = '<div class="n-empty">Headlines unavailable (' + esc(e.message) + ').</div>';
    });
  }
  function host(url) {
    var m = /^https?:\/\/(?:www\.)?([^/]+)/.exec(url || '');
    return m ? m[1] : 'news.ycombinator.com';
  }
  function ago(iso) {
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago';
  }
  function renderNews() {
    var h = new Date().getHours();
    var when = h < 12 ? 'this morning' : h < 17 ? 'this afternoon' : 'tonight';
    $('nHead').innerHTML = '<b>Top news,</b> ' + when;
    if (!news.length) return;
    var f = news[0];
    var html = '<div class="n-feature"><div class="n-meta">' + I.spark + esc(host(f.url)) + ' · ' + f.points + ' points</div>' +
      '<div class="n-title">' + esc(f.title) + '</div></div>';
    news.slice(1).forEach(function (n, i) {
      html += '<div class="n-item"><span class="ico ' + (i ? 'b' : 'a') + '">' + esc(host(n.url).charAt(0).toUpperCase()) + '</span>' +
        '<div><div class="t">' + esc(n.title) + '</div><div class="s">' + esc(host(n.url)) + ' · ' + n.num_comments +
        ' comments · ' + ago(n.created_at) + '</div></div></div>';
    });
    $('nBody').innerHTML = html;
  }

  // ---- weather
  var daily = [];
  var hourly = [];
  function renderWeather() {
    var el = $('tWx');
    var w = st(cfg.weather);
    if (!el || !w) return;
    var a = w.attributes;
    var c = cond(w.state);
    var now = Date.now();
    var next = hourly.filter(function (f) { return new Date(f.datetime).getTime() > now - 3600000; }).slice(0, 5);
    var line;
    var wet = null;
    for (var i = 0; i < next.length; i++) {
      if ((next[i].precipitation_probability || 0) >= 40 || WET[next[i].condition]) { wet = next[i]; break; }
    }
    if (wet) {
      var wh = new Date(wet.datetime).getHours();
      var wc = cond(wet.condition)[0];
      line = '<b>' + esc(WET[wet.condition] ? wc : 'Rain') + '</b>from ' + hour12(wh) + ' ' + ampm(wh);
    } else {
      line = '<b>' + esc(c[0]) + '</b>' + (daily[0] ? 'high of ' + round(daily[0].temperature) + '°' : '');
    }
    var useRain = next.some(function (f) { return (f.precipitation_probability || 0) >= 15; });
    var vals = next.map(function (f) { return useRain ? (f.precipitation_probability || 0) : f.temperature; });
    var lo = useRain ? 0 : Math.min.apply(null, vals) - 3;
    var hi = useRain ? 100 : Math.max.apply(null, vals);
    var bars = next.map(function (f, k) {
      var hgt = Math.max(14, Math.round(((vals[k] - lo) / Math.max(1, hi - lo)) * 76));
      var hh = new Date(f.datetime).getHours();
      return '<div class="w-bar' + (k === 0 ? ' now' : '') + '"><i style="height:' + hgt + 'px"></i>' + hour12(hh) + '</div>';
    }).join('');
    el.innerHTML = weatherArt(c[1], dark) +
      '<div class="w-place">' + esc(cfg.airPlace || a.friendly_name || '') + '</div>' +
      '<div class="w-temp serif tnum">' + round(a.temperature) + '°</div>' +
      '<div class="w-cond">' + line + '</div>' +
      '<div class="w-bars">' + bars + '</div>';
  }

  // ---- air
  var air = null;
  var home = null;
  function loadAir() {
    if (!home) return;
    getJSON('http://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + home.latitude +
      '&longitude=' + home.longitude + '&current=us_aqi').then(function (j) {
      air = j.current && j.current.us_aqi;
      renderAir();
    }).catch(function () { /* keep the last value */ });
  }
  var AQI = [[50, 'Good'], [100, 'Moderate'], [150, 'Sensitive'], [200, 'Unhealthy'], [300, 'Very unhealthy'], [99999, 'Hazardous']];
  function renderAir() {
    var el = $('tAir');
    if (!el) return;
    var cat = AQI[0][1];
    for (var i = 0; i < AQI.length; i++) { if (air <= AQI[i][0]) { cat = AQI[i][1]; break; } }
    var co2 = st(cfg.room.co2);
    var pos = air == null ? 0 : Math.min(air, 250) / 250 * 100;
    el.innerHTML = '<span class="chip"><span class="ico">' + I.leaf + '</span>air · ' + esc(cfg.airPlace || 'outside') + '</span>' +
      '<div class="a-big">' + (air == null ? '<b>AQI –</b>' : '<b>AQI ' + Math.round(air) + '</b>' + cat) + '</div>' +
      (co2 ? '<div class="a-in">Inside · CO₂ <b>' + round(co2.state) + '</b> ppm</div>' : '') +
      '<div class="a-scale"><i style="background:#9FD39A"></i><i style="background:#B9DC8A"></i><i style="background:#EED97A"></i>' +
      '<i style="background:#F3B27A"></i><i style="background:#EE8A86"></i>' +
      (air == null ? '' : '<span class="a-dot" style="left:' + pos + '%"></span>') + '</div>';
  }

  // ---- room
  function renderRoom() {
    var r = cfg.room;
    var t = st(r.temperature);
    var h = st(r.humidity);
    var co2 = st(r.co2);
    var co2v = co2 ? parseFloat(co2.state) : NaN;
    if ($('rStats')) {
      $('rStats').innerHTML = (t ? '<span class="chip">' + round(t.state) + '°</span>' : '') +
        (h ? '<span class="chip">' + round(h.state) + '%</span>' : '') +
        (co2 ? '<span class="chip' + (co2v > 1000 ? ' warn' : '') + '">CO₂ ' + round(co2v) + '</span>' : '');
    }
    r.tiles.forEach(function (tl) {
      var s = st(tl.entity);
      var el = qs('[data-toggle="' + tl.entity + '"]');
      var sub = qs('[data-sub="' + tl.entity + '"]');
      if (!el) return;
      if (!s || s.state === 'unavailable') { el.className = 'r-tile na'; sub.textContent = 'Unavailable'; return; }
      var on = s.state === 'on';
      el.className = 'r-tile' + (on ? ' on' : '');
      var b = s.attributes.brightness;
      var p = s.attributes.percentage;
      sub.textContent = !on ? 'Off' : b ? Math.round(b / 2.55) + '%' : p ? p + '%' : 'On';
    });
    if (r.thermostat) renderThermo(r.thermostat.entity);
    renderAir();
  }

  // ------------------------------------------------------------------ thermostats (shared)
  var pendingTemp = {};
  var tempTimers = {};
  function renderThermo(id) {
    var s = st(id);
    var mode = qs('[data-mode="' + id + '"]');
    var tgt = qs('[data-target="' + id + '"]');
    if (!s || !mode) return;
    var a = s.attributes;
    // "70° now · cooling" (or "· cool" when idle), kept to one line.
    var doing = a.hvac_action && a.hvac_action !== 'idle' && a.hvac_action !== 'off' ? a.hvac_action : (s.state === 'heat_cool' ? 'auto' : s.state);
    mode.innerHTML = round(a.current_temperature) + '° now · <span class="mode-' + esc(s.state) + '">' + esc(doing) + '</span>';
    var target = pendingTemp[id] != null ? pendingTemp[id] : a.temperature;
    tgt.textContent = target != null ? round(target) + '°' :
      (a.target_temp_low != null ? round(a.target_temp_low) + '–' + round(a.target_temp_high) : '–');
  }
  function stepThermo(id, step) {
    var s = st(id);
    if (!s || s.attributes.temperature == null) { toast('Set this one in Home Assistant'); return; }
    var base = pendingTemp[id] != null ? pendingTemp[id] : s.attributes.temperature;
    pendingTemp[id] = base + step * (s.attributes.target_temp_step || 1);
    renderThermo(id);
    // Send once the taps stop, so +3 is one service call.
    clearTimeout(tempTimers[id]);
    tempTimers[id] = setTimeout(function () {
      act('climate', 'set_temperature', { temperature: pendingTemp[id] }, { entity_id: id }, 'Thermostat')
        .then(function () { setTimeout(function () { delete pendingTemp[id]; renderThermo(id); }, 3000); });
    }, 1200);
  }

  $('view-today').addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    var tog = t.getAttribute('data-toggle');
    if (tog) {
      t.className += ' busy';
      act(tog.split('.')[0], 'toggle', {}, { entity_id: tog }, 'Toggle');
      return;
    }
    var scene = t.getAttribute('data-scene');
    if (scene != null) {
      var s = cfg.room.scenes[+scene];
      if (s.off) act('homeassistant', 'turn_off', {}, { entity_id: s.off }, s.name);
      else act('scene', 'turn_on', {}, { entity_id: s.entity }, s.name);
      toast(s.name);
      return;
    }
    var step = t.getAttribute('data-step');
    if (step) { stepThermo(t.closest('[data-thermo]').getAttribute('data-thermo'), +step); return; }
    var cam = t.getAttribute('data-cam');
    if (cam) openLive(cam);
  });

  // ------------------------------------------------------------------ chores
  var todoItems = [];
  function buildChores() {
    $('view-chores').innerHTML = '<div class="tile t-chore chores"><div class="ch-head"><div class="ch-title" id="chTitle"></div></div>' +
      '<div class="ch-list" id="chList"></div></div>';
  }
  function loadTodo() {
    if (!cfg.todo || !ha.connected) return;
    ha.call('todo/item/list', { entity_id: cfg.todo }).then(function (r) {
      todoItems = r.items || [];
      renderTodo();
    }).catch(function () { /* keep the last list */ });
  }
  function dueChip(due) {
    if (!due) return '';
    var d = new Date(due.length === 10 ? due + 'T00:00:00' : due);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var days = Math.floor((d - today) / 86400000);
    var label = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow'
      : days < 7 ? 'due ' + DAYS[d.getDay()].slice(0, 3) : 'due ' + (d.getMonth() + 1) + '/' + d.getDate();
    return '<span class="due' + (days < 0 ? ' late' : '') + '">' + label + '</span>';
  }
  function renderTodo() {
    var open = todoItems.filter(function (i) { return i.status === 'needs_action'; });
    $('chTitle').innerHTML = '<b>' + esc(cfg.todoTitle || 'Chores') + ',</b>' + open.length + ' left';
    $('chList').innerHTML = open.map(function (i) {
      return '<button class="ch-item" data-todo="' + esc(i.uid) + '"><i></i><span>' + esc(i.summary) + '</span>' + dueChip(i.due) + '</button>';
    }).join('') || '<div class="ch-item">All clear.</div>';
  }
  $('view-chores').addEventListener('click', function (e) {
    var t = e.target.closest('[data-todo]');
    if (!t) return;
    t.className += ' done';
    act('todo', 'update_item', { item: t.getAttribute('data-todo'), status: 'completed' }, { entity_id: cfg.todo }, 'To-do')
      .then(function () { setTimeout(loadTodo, 600); });
  });

  // ------------------------------------------------------------------ cameras
  function camName(id) {
    for (var i = 0; i < cfg.cameras.length; i++) if (cfg.cameras[i].entity === id) return cfg.cameras[i].name;
    return id;
  }
  function buildCameras() {
    var tiles = cfg.cameras.map(function (c) {
      return '<button class="cam" data-cam="' + c.entity + '"><img data-snap="' + c.entity + '" alt="">' +
        '<span class="cam-tag">' + esc(c.name) + '</span><span class="cam-age" data-age="' + c.entity + '"></span></button>';
    }).join('');
    for (var i = cfg.cameras.length; i < 9; i++) tiles += '<div class="cam cam-hint">Tap a camera for the live view.<br>Snapshots refresh every ' + cfg.snapshotSeconds + ' s.</div>';
    $('view-cameras').innerHTML = '<div class="cams">' + tiles + '</div>';
  }
  $('view-cameras').addEventListener('click', function (e) {
    var t = e.target.closest('[data-cam]');
    if (t) openLive(t.getAttribute('data-cam'));
  });

  var snapAt = {};
  var snapBusy = {};
  var snapFail = {};
  // Load each snapshot off-screen and swap it in when complete, so tiles never flash empty.
  function loadSnap(id) {
    var s = st(id);
    if (!s || !s.attributes.entity_picture || snapBusy[id]) return;
    snapBusy[id] = true;
    var img = new Image();
    var done = function (ok) {
      snapBusy[id] = false;
      // A failed camera waits a full interval too, so a dead feed isn't retried constantly.
      snapAt[id] = Date.now();
      snapFail[id] = !ok;
      if (!ok) return renderAges();
      var els = document.querySelectorAll('img[data-snap="' + id + '"]');
      for (var i = 0; i < els.length; i++) els[i].src = img.src;
    };
    img.onload = function () { done(true); };
    img.onerror = function () { done(false); };
    // HA scales the snapshot server-side; full-size frames (one camera sends 4 MB) are too heavy here.
    img.src = cfg.haUrl + s.attributes.entity_picture + '&width=' + (cfg.snapshotWidth || 480) + '&_=' + Date.now();
  }
  function visibleCams() {
    if ($('overlay').className.indexOf('open') >= 0) return [];
    if (current === 'cameras') return cfg.cameras.map(function (c) { return c.entity; });
    if (current === 'today') return [cfg.todayCamera];
    return [];
  }
  function refreshSnapshots(now) {
    visibleCams().forEach(function (id, i) {
      if (now || !snapAt[id] || Date.now() - snapAt[id] > cfg.snapshotSeconds * 1000) {
        // Stagger requests so the A33 decodes one image at a time.
        setTimeout(function () { loadSnap(id); }, i * 350);
      }
    });
  }
  function renderAges() {
    var els = document.querySelectorAll('[data-age]');
    for (var i = 0; i < els.length; i++) {
      var id = els[i].getAttribute('data-age');
      var t = snapAt[id];
      var s = t ? Math.round((Date.now() - t) / 1000) : null;
      els[i].textContent = snapFail[id] ? 'No snapshot' : s == null ? '' : s < 15 ? 'live' : s + ' s ago';
    }
  }

  var liveTimer;
  function openLive(id) {
    var s = st(id);
    if (!s || !s.attributes.access_token) { toast('Camera unavailable'); return; }
    var ov = $('overlay');
    ov.className = 'overlay open';
    ov.innerHTML = '<img id="liveImg" alt=""><span class="cam-tag">' + esc(camName(id)) + ' · live</span>' +
      '<button class="close" id="liveClose">×</button>';
    // MJPEG stream; closed after 90 s so a forgotten view doesn't keep decoding.
    $('liveImg').src = cfg.haUrl + '/api/camera_proxy_stream/' + id + '?token=' + encodeURIComponent(s.attributes.access_token);
    clearTimeout(liveTimer);
    liveTimer = setTimeout(closeOverlay, 90000);
  }
  function closeOverlay() {
    var img = $('liveImg');
    if (img) img.src = 'data:,';
    $('overlay').className = 'overlay';
    $('overlay').innerHTML = '';
    clearTimeout(liveTimer);
    refreshSnapshots(true);
  }
  var pendingConfirm = null;
  function confirmThen(title, text, goLabel, fn) {
    pendingConfirm = fn;
    var ov = $('overlay');
    ov.className = 'overlay open dialog';
    ov.innerHTML = '<div class="confirm"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' +
      '<div class="row"><button data-cancel>Cancel</button><button class="go" data-confirm>' + esc(goLabel) + '</button></div></div>';
  }
  $('overlay').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) { if ($('overlay').className.indexOf('dialog') < 0) closeOverlay(); return; }
    if (b.id === 'liveClose' || b.getAttribute('data-cancel') != null) closeOverlay();
    else if (b.getAttribute('data-confirm') != null && pendingConfirm) { var f = pendingConfirm; pendingConfirm = null; closeOverlay(); f(); }
  });

  // ------------------------------------------------------------------ home
  function row(attrs, icon, name, subAttr) {
    return '<button class="h-row" ' + attrs + '>' + icon + '<div class="n">' + esc(name) +
      '<span ' + subAttr + '>–</span></div></button>';
  }
  function buildHome() {
    var doors = cfg.locks.map(function (l) {
      return row('data-lock="' + l.entity + '" data-name="' + esc(l.name) + '"', '<span data-icon="' + l.entity + '">' + I.lock + '</span>', l.name, 'data-sub="' + l.entity + '"');
    }).join('');
    if (cfg.garage) doors += row('data-garage="' + cfg.garage.entity + '"', I.garage, cfg.garage.name, 'data-sub="' + cfg.garage.entity + '"');
    var status = cfg.status.map(function (s) {
      return '<div class="h-row" data-status="' + s.entity + '">' + (I[s.icon] || I.drive) + '<div class="n">' + esc(s.name) +
        '</div><span class="val serif tnum" data-sv="' + s.entity + '">–</span></div>';
    }).join('');
    var thermos = cfg.thermostats.map(function (t) {
      return '<div class="h-row" data-thermo="' + t.entity + '">' + I.thermo + '<div class="n">' + esc(t.name) +
        '<span data-mode="' + t.entity + '">–</span></div><button class="round" data-step="-1">–</button>' +
        '<span class="val serif tnum" style="width:62px;text-align:center;margin:0" data-target="' + t.entity + '">–</span>' +
        '<button class="round" data-step="1">+</button></div>';
    }).join('');
    var covers = cfg.homeCovers.map(function (c) {
      return '<div class="h-row" data-cover="' + c.entity + '">' + I.blind + '<div class="n">' + esc(c.name) +
        '<span data-sub="' + c.entity + '">–</span></div><button class="btn" data-tilt="open">Open</button>' +
        '<button class="btn" data-tilt="close">Close</button></div>';
    }).join('');
    $('view-home').innerHTML = '<div class="home">' +
      '<div class="h-col"><div class="h-label">Doors</div>' + doors + '<div class="h-label gap">Status</div>' + status + '</div>' +
      '<div class="h-col"><div class="h-label">Climate</div>' + thermos + '</div>' +
      '<div class="h-col"><div class="h-label">Blinds</div>' + covers + '</div>' +
      '</div>';
  }

  function renderHome() {
    cfg.locks.forEach(function (l) {
      var s = st(l.entity);
      var el = qs('[data-lock="' + l.entity + '"]');
      if (!el) return;
      var state = s ? s.state : 'unavailable';
      el.className = 'h-row ' + (state === 'locked' ? 'locked' : state === 'unlocked' ? 'unlocked' : state === 'unavailable' ? 'na' : 'moving');
      qs('[data-icon="' + l.entity + '"]').innerHTML = state === 'unlocked' ? I.unlock : I.lock;
      qs('[data-sub="' + l.entity + '"]').textContent = cap(state);
    });
    if (cfg.garage) {
      var g = st(cfg.garage.entity);
      var gel = qs('[data-garage="' + cfg.garage.entity + '"]');
      var gs = g ? g.state : 'unavailable';
      if (gel) {
        gel.className = 'h-row ' + (gs === 'closed' ? 'locked' : gs === 'open' ? 'open' : gs === 'unavailable' ? 'na' : 'moving');
        qs('[data-sub="' + cfg.garage.entity + '"]').textContent = cap(gs);
      }
    }
    cfg.status.forEach(function (c) {
      var s = st(c.entity);
      var el = qs('[data-status="' + c.entity + '"]');
      if (!el) return;
      var cls = 'h-row';
      var text = s ? s.state : '–';
      if (s && c.unit) {
        var v = parseFloat(s.state);
        text = round(v) + c.unit;
        if (v > c.alertAbove) cls += ' alert'; else if (v > c.warnAbove) cls += ' warn';
      } else if (s && c.okStates) {
        text = (c.labels && c.labels[s.state]) || cap(s.state);
        if (c.okStates.indexOf(s.state) < 0) cls += s.state === 'on' ? ' alert' : ' warn';
      }
      el.className = cls;
      qs('[data-sv="' + c.entity + '"]').textContent = text;
    });
    cfg.thermostats.forEach(function (t) { renderThermo(t.entity); });
    cfg.homeCovers.forEach(function (c) {
      var s = st(c.entity);
      var el = qs('[data-cover="' + c.entity + '"] [data-sub]');
      if (!el) return;
      var p = s && s.attributes.current_tilt_position;
      el.textContent = !s ? '–' : p != null ? 'Tilt ' + p + '%' : cap(s.state);
    });
  }

  $('view-home').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var lock = b.getAttribute('data-lock');
    if (lock) {
      var ls = st(lock);
      var name = b.getAttribute('data-name');
      if (ls && ls.state === 'locked') {
        confirmThen('Unlock ' + name + '?', 'The door will unlock right away.', 'Unlock', function () {
          act('lock', 'unlock', {}, { entity_id: lock }, 'Unlock');
        });
      } else {
        act('lock', 'lock', {}, { entity_id: lock }, 'Lock');
        toast('Locking ' + name);
      }
      return;
    }
    var garage = b.getAttribute('data-garage');
    if (garage) {
      var gs = st(garage);
      if (gs && gs.state === 'closed') {
        confirmThen('Open the garage?', 'The garage door will start opening.', 'Open', function () {
          act('cover', 'open_cover', {}, { entity_id: garage }, 'Garage');
        });
      } else {
        act('cover', 'close_cover', {}, { entity_id: garage }, 'Garage');
        toast('Closing garage');
      }
      return;
    }
    var step = b.getAttribute('data-step');
    if (step) { stepThermo(b.closest('[data-thermo]').getAttribute('data-thermo'), +step); return; }
    var tilt = b.getAttribute('data-tilt');
    if (tilt) {
      var cid = b.closest('[data-cover]').getAttribute('data-cover');
      act('cover', tilt === 'open' ? 'open_cover_tilt' : 'close_cover_tilt', {}, { entity_id: cid }, 'Blind');
    }
  });

  // ------------------------------------------------------------------ clock loop
  var lastMinute = -1;
  function tick() {
    var now = new Date();
    var h = now.getHours();
    tickClock(now);
    var dim = cfg.dimFrom != null && (cfg.dimFrom > cfg.dimUntil ? (h >= cfg.dimFrom || h < cfg.dimUntil) : (h >= cfg.dimFrom && h < cfg.dimUntil));
    $('night').className = 'night' + (dim ? ' on' : '');
    renderAges();
    refreshSnapshots(false);
    if (now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      applyTheme();
      renderWeather();
      if (lastMinute % 15 === 0) { loadNews(); loadAir(); }
      if (lastMinute % 5 === 0) renderNews();
    }
    // Fresh page once a day at 3:00, to keep a long-running WebView lean.
    if (h === 3 && now.getMinutes() === 0 && now.getSeconds() < 2 && performance.now() > 120000) location.reload();
  }

  // ------------------------------------------------------------------ wiring
  function watched() {
    var r = cfg.room;
    var ids = [cfg.weather, 'sun.sun', cfg.todo, r.temperature, r.humidity, r.co2, r.thermostat && r.thermostat.entity];
    [r.tiles, cfg.cameras, cfg.locks, cfg.thermostats, cfg.homeCovers, cfg.status].forEach(function (list) {
      list.forEach(function (x) { ids.push(x.entity); });
    });
    if (cfg.garage) ids.push(cfg.garage.entity);
    return ids.filter(function (id, i) { return id && ids.indexOf(id) === i; });
  }

  ha.onStatus(function (ok, msg) {
    $('railStatus').className = 'rail-status ' + (ok ? 'ok' : 'bad');
    if (!ok && msg === 'token rejected') toast('Home Assistant rejected the token');
  });
  var lastTodoState = null;
  ha.onState(function (changed) {
    renderRoom();
    renderHome();
    if (changed.indexOf('sun.sun') >= 0) applyTheme();
    if (changed.indexOf(cfg.weather) >= 0) renderWeather();
    var todo = st(cfg.todo);
    if (todo && todo.state !== lastTodoState) { lastTodoState = todo.state; loadTodo(); }
    var firstSnap = cfg.cameras.some(function (c) { return changed.indexOf(c.entity) >= 0 && !snapAt[c.entity]; });
    if (firstSnap) refreshSnapshots(true);
  });
  ha.onConnect(function () {
    ha.call('get_config').then(function (c) { home = c; loadAir(); }).catch(function () {});
    ha.subscribe({ type: 'weather/subscribe_forecast', entity_id: cfg.weather, forecast_type: 'daily' }, function (ev) {
      daily = ev.forecast || [];
      renderWeather();
    }).catch(function () {});
    ha.subscribe({ type: 'weather/subscribe_forecast', entity_id: cfg.weather, forecast_type: 'hourly' }, function (ev) {
      hourly = ev.forecast || [];
      renderWeather();
    }).catch(function () {});
  });

  buildToday();
  buildChores();
  buildCameras();
  buildHome();
  applyTheme();
  renderNews();
  renderAir();
  tick();
  loadNews();
  setInterval(tick, 1000);
  if (!window.HA_TOKEN) {
    $('railStatus').className = 'rail-status bad';
    toast('No Home Assistant token: run office/deploy.sh');
  } else {
    ha.connect(watched());
  }
})();
