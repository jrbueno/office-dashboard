// Office HQ: the Home HQ look with live Home Assistant data, for a wall-mounted photo frame (WebView 106).
// Loads from the frame's own storage. Live data comes over one HA WebSocket (ha.js); news and
// outdoor air come straight from public APIs.
(function () {
  'use strict';

  var cfg = window.DASHBOARD_CONFIG;
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
  function num(id) { var s = st(id); var n = s ? parseFloat(s.state) : NaN; return isNaN(n) ? null : n; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function round(v) { var n = parseFloat(v); return isNaN(n) ? '–' : Math.round(n); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function hour12(h) { return (h % 12) || 12; }
  function ampm(h) { return h < 12 ? 'AM' : 'PM'; }
  function clockText(d) { return (cfg.clock24h ? pad(d.getHours()) : hour12(d.getHours())) + ':' + pad(d.getMinutes()); }
  function dur(min) {
    min = Math.max(0, Math.round(min));
    return min < 60 ? min + 'm' : Math.floor(min / 60) + 'h ' + pad(min % 60) + 'm';
  }

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
  var P = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    cloud: '<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 12.5 4 4 0 0 1 17.5 19z"/>',
    part: '<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4"/><path d="M15.9 10A4 4 0 0 0 8 11"/><path d="M17.5 20H9a4 4 0 1 1 1.3-7.8A5 5 0 0 1 20 15a3 3 0 0 1-2.5 5z"/>',
    rain: '<path d="M17.5 15H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 8.5 4 4 0 0 1 17.5 15z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    snow: '<path d="M17.5 15H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 8.5 4 4 0 0 1 17.5 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>',
    storm: '<path d="M17.5 15H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 8.5 4 4 0 0 1 17.5 15z"/><path d="M13 15l-3 4h4l-2 4"/>',
    fog: '<path d="M4 10h16M6 14h14M4 18h12"/>'
  };
  var I = {
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
  var COND = {
    'clear-night': ['Clear', 'moon'], sunny: ['Sunny', 'sun'], partlycloudy: ['Partly cloudy', 'part'],
    cloudy: ['Cloudy', 'cloud'], fog: ['Fog', 'fog'], rainy: ['Rain', 'rain'], pouring: ['Pouring', 'rain'],
    snowy: ['Snow', 'snow'], 'snowy-rainy': ['Sleet', 'snow'], hail: ['Hail', 'snow'],
    lightning: ['Lightning', 'storm'], 'lightning-rainy': ['Storms', 'storm'],
    windy: ['Windy', 'cloud'], 'windy-variant': ['Windy', 'cloud'], exceptional: ['Alert', 'storm']
  };
  function cond(c) { return COND[c] || [cap(c) || '—', 'cloud']; }
  var WET = { rainy: 1, pouring: 1, 'lightning-rainy': 1, snowy: 1, 'snowy-rainy': 1, hail: 1 };

  // ------------------------------------------------------------------ air quality scales
  // US AQI from PM2.5 with EPA's 2024 breakpoints (Good now ends at 9.0 µg/m³).
  var PM_BP = [[0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]];
  function aqiFromPm25(pm) {
    if (pm == null) return null;
    var c = Math.floor(pm * 10) / 10;
    for (var i = 0; i < PM_BP.length; i++) {
      var b = PM_BP[i];
      if (c <= b[1]) return Math.round((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
    }
    return 500;
  }
  function aqiLevel(a) {
    return a == null ? ['', '–'] : a <= 50 ? ['good', 'Good'] : a <= 100 ? ['ok', 'Moderate']
      : a <= 150 ? ['poor', 'Sensitive groups'] : a <= 200 ? ['bad', 'Unhealthy'] : ['vbad', 'Very unhealthy'];
  }
  // CO2: ~420 outdoors; under 800 well ventilated; 1000 is the usual code benchmark; 1400+ means ventilate.
  function co2Level(v) {
    return v == null ? ['', '–'] : v < 800 ? ['good', 'fresh'] : v < 1000 ? ['ok', 'OK'] : v < 1400 ? ['poor', 'stuffy'] : ['bad', 'ventilate'];
  }
  // Sensirion VOC index is relative: 100 = this room's recent average, below = cleaner than usual.
  function vocLevel(v) {
    return v == null ? ['', '–'] : v <= 100 ? ['good', v < 90 ? 'below usual' : 'usual'] : v <= 150 ? ['ok', 'slightly up']
      : v <= 250 ? ['poor', 'elevated'] : ['bad', 'high'];
  }
  // Sensirion NOx index baseline is 1; a rise points at combustion (gas stove, candles, traffic).
  function noxLevel(v) {
    return v == null ? ['', '–'] : v <= 20 ? ['good', 'normal'] : v <= 150 ? ['poor', 'combustion?'] : ['bad', 'high'];
  }
  function rhLevel(v) {
    return v == null ? ['', '–'] : v >= 40 && v <= 60 ? ['good', 'ideal'] : v >= 30 && v <= 70 ? ['ok', v < 40 ? 'dry-ish' : 'humid-ish'] : ['poor', v < 30 ? 'dry' : 'humid'];
  }

  // ------------------------------------------------------------------ views + rail
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
      return '<button class="rt" data-toggle="' + t.entity + '">' + (I[t.icon] || I.bulb) +
        '<span><b>' + esc(t.name) + '</b><small data-sub="' + t.entity + '">–</small></span></button>';
    }).join('');
    var scenes = r.scenes.map(function (s, i) { return '<button class="scene" data-scene="' + i + '">' + esc(s.name) + '</button>'; }).join('');
    var th = r.thermostat;
    $('view-today').innerHTML = '<div class="today">' +
      '<div class="t-clock" id="tClock"></div>' +
      '<div class="t-weather" id="tWeather"></div>' +
      '<div class="t-air" id="tAir"></div>' +
      '<div class="card t-news"><div class="hn-bar"><span class="hn-y">Y</span><b>Hacker News</b><span>top 10</span><small id="newsAge"></small></div>' +
        '<div class="news-list" id="newsList"><div class="news-empty">Loading headlines…</div></div></div>' +
      '<button class="t-cam" data-cam="' + cfg.todayCamera + '"><img data-snap="' + cfg.todayCamera + '" alt="">' +
        '<div class="cam-cap"><b>' + esc(camName(cfg.todayCamera)) + '</b><span data-age="' + cfg.todayCamera + '"></span></div></button>' +
      '<div class="card t-room">' +
        '<div class="room-head"><span class="label">' + esc(r.name) + '</span><span class="meta" id="roomMeta"></span></div>' +
        '<div class="room-tiles">' + tiles + '</div>' +
        '<div class="room-foot">' + scenes +
          (th ? '<div class="thermo" data-thermo="' + th.entity + '"><div class="tl"><b>' + esc(th.name) + '</b><span data-mode="' + th.entity + '">–</span></div>' +
            '<button class="round" data-step="-1">–</button><span class="v num" data-target="' + th.entity + '">–</span>' +
            '<button class="round" data-step="1">+</button></div>' : '') +
        '</div></div>' +
      '<div class="t-desk" id="tDesk"></div>' +
      '</div>';
  }

  function renderClock(now) {
    $('tClock').innerHTML = '<div class="t-time num">' + clockText(now) + (cfg.clock24h ? '' : '<span class="t-ampm">' + ampm(now.getHours()) + '</span>') + '</div>' +
      '<div class="t-date"><b>' + DAYS[now.getDay()] + '</b> ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + '</div>';
    $('railClock').innerHTML = '<b>' + clockText(now) + '</b><span>' + (cfg.clock24h ? '' : ampm(now.getHours())) + '</span>';
  }

  // ---- weather (now + summary + next 6 hours)
  var daily = [];
  var hourly = [];
  function renderWeather() {
    var el = $('tWeather');
    var w = st(cfg.weather);
    if (!el || !w) return;
    var a = w.attributes;
    var c = cond(w.state);
    var now = Date.now();
    var next = hourly.filter(function (f) { return new Date(f.datetime).getTime() > now - 3600000; }).slice(0, 6);
    var today = daily[0];
    var wet = null;
    for (var i = 0; i < next.length; i++) {
      if ((next[i].precipitation_probability || 0) >= 50 || WET[next[i].condition]) { wet = next[i]; break; }
    }
    var say;
    if (wet) {
      var wh = new Date(wet.datetime).getHours();
      say = '<b>Rain around ' + hour12(wh) + ' ' + ampm(wh).toLowerCase() + '.</b> Close a window before you leave.';
    } else if (today) {
      var night = new Date().getHours() >= 18;
      say = '<b>' + c[0] + (night ? ' tonight' : ' today') + '.</b> ' + (night ? 'Low of ' + round(today.templow) + '°' : 'High of ' + round(today.temperature) + '°') + '.';
    } else {
      say = '<b>' + c[0] + '.</b>';
    }
    var tmin = Math.min.apply(null, next.map(function (h) { return h.temperature; }));
    var tmax = Math.max.apply(null, next.map(function (h) { return h.temperature; }));
    var hours = next.map(function (h) {
      var d = new Date(h.datetime);
      var lift = tmax === tmin ? 0 : Math.round((h.temperature - tmin) / (tmax - tmin) * 8);
      var wetH = (h.precipitation_probability || 0) >= 50 || WET[h.condition];
      return '<div class="hr' + (wetH ? ' is-wet' : '') + '"><span class="hr-l">' + hour12(d.getHours()) + ampm(d.getHours()).charAt(0).toLowerCase() + '</span>' +
        '<span class="hr-i wx-c-' + cond(h.condition)[1] + '" style="transform:translateY(' + -lift + 'px)">' + svg(P[cond(h.condition)[1]], 22) + '</span><b>' + round(h.temperature) + '°</b></div>';
    }).join('');
    el.innerHTML = '<div class="wx-top"><span class="wx-c-' + c[1] + '">' + svg(P[c[1]], 58) + '</span>' + '<span class="wx-temp num">' + round(a.temperature) + '°</span>' +
      '<span class="wx-meta"><b>' + esc(c[0]) + '</b><span>' + (today ? 'H ' + round(today.temperature) + '°  L ' + round(today.templow) + '°' : esc(cfg.place)) + '</span></span></div>' +
      '<div class="wx-say">' + say + '</div><div class="wx-hours">' + hours + '</div>';
  }

  // ---- air: outside vs inside, plus AIR-1 detail
  var outside = null;
  var home = null;
  function loadOutside() {
    if (!home) return;
    getJSON('http://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + home.latitude +
      '&longitude=' + home.longitude + '&current=us_aqi,pm2_5').then(function (j) {
      outside = j.current || null;
      renderAir();
    }).catch(function () { /* keep the last value */ });
  }
  function metric(level, value, unit, name, desc) {
    return '<div class="air-m"><i class="dot lv-' + level + '"></i><b class="tx-' + level + '">' + value + '</b>' + (unit ? '<span>' + unit + '</span>' : '') +
      '<span>' + name + (desc ? ' · ' + desc : '') + '</span></div>';
  }
  function renderAir() {
    var el = $('tAir');
    if (!el) return;
    var A = cfg.air;
    var outAqi = outside ? outside.us_aqi : null;
    var inAqi = aqiFromPm25(num(A.pm25));
    var lo = aqiLevel(outAqi);
    var li = aqiLevel(inAqi);
    var co2 = num(A.co2), voc = num(A.voc), nox = num(A.nox), rh = num(A.humidity);
    var lc = co2Level(co2), lv = vocLevel(voc), ln = noxLevel(nox), lr = rhLevel(rh);
    el.innerHTML = '<div class="air-vs">' +
      '<div class="air-side"><div class="label">Outside AQI</div><span class="num tx-' + lo[0] + '">' + (outAqi == null ? '–' : Math.round(outAqi)) + '</span>' +
        '<div class="air-bar lv-' + lo[0] + '"></div><small class="tx-' + lo[0] + '">' + lo[1] + '</small></div><i class="sep"></i>' +
      '<div class="air-side"><div class="label">Inside AQI</div><span class="num tx-' + li[0] + '">' + (inAqi == null ? '–' : inAqi) + '</span>' +
        '<div class="air-bar lv-' + li[0] + '"></div><small class="tx-' + li[0] + '">' + li[1] + (num(A.pm25) != null ? ' · PM2.5 ' + num(A.pm25).toFixed(1) : '') + '</small></div></div>' +
      '<div class="air-grid">' +
        metric(lc[0], co2 == null ? '–' : Math.round(co2), 'ppm', 'CO₂', lc[1]) +
        metric(lv[0], voc == null ? '–' : Math.round(voc), '', 'VOC', lv[1]) +
        metric(ln[0], nox == null ? '–' : Math.round(nox), '', 'NOx', ln[1]) +
        metric(lr[0], rh == null ? '–' : Math.round(rh) + '%', '', 'RH', lr[1]) +
      '</div>';
  }

  // ---- hacker news
  var news = [];
  function loadNews() {
    if (!cfg.newsUrl) return;
    getJSON(cfg.newsUrl).then(function (j) {
      news = (j.hits || []).slice(0, 10);
      renderNews();
    }).catch(function (e) {
      if (!news.length) $('newsList').innerHTML = '<div class="news-empty">Headlines unavailable (' + esc(e.message) + ').</div>';
    });
  }
  function host(url) {
    var m = /^https?:\/\/(?:www\.)?([^/]+)/.exec(url || '');
    return m ? m[1] : 'news.ycombinator.com';
  }
  function ago(iso) {
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 60 ? m + 'm' : Math.round(m / 60) + 'h';
  }
  function renderNews() {
    if (!news.length) return;
    $('newsList').innerHTML = news.map(function (n, i) {
      return '<div class="news-i"><span class="news-n num">' + (i + 1) + '</span><div class="news-t"><b>' + esc(n.title) + '</b>' +
        '<span><em>' + n.points + ' pts</em> · ' + esc(host(n.url)) + ' · ' + n.num_comments + ' comments · ' + ago(n.created_at) + '</span></div></div>';
    }).join('');
    $('newsAge').textContent = 'updated ' + clockText(new Date());
  }

  // ---- room
  function renderRoom() {
    var r = cfg.room;
    var t = num(r.temperature);
    var rh = num(cfg.air.humidity);
    if ($('roomMeta')) $('roomMeta').innerHTML = (t != null ? '<b>' + Math.round(t) + '°</b> inside' : '') + (rh != null ? ' · <b>' + Math.round(rh) + '%</b> humidity' : '');
    r.tiles.forEach(function (tl) {
      var s = st(tl.entity);
      var el = qs('[data-toggle="' + tl.entity + '"]');
      var sub = qs('[data-sub="' + tl.entity + '"]');
      if (!el) return;
      if (!s || s.state === 'unavailable') { el.className = 'rt na'; sub.textContent = 'Unavailable'; return; }
      var on = s.state === 'on';
      var domain = tl.entity.split('.')[0];
      el.className = 'rt' + (on ? ' on' : '') + (on && domain !== 'light' ? ' fan-on' : '');
      // A colour light tints its tile with its real colour (soft, so text stays readable).
      var rgb = s.attributes.rgb_color;
      el.style.background = on && domain === 'light' && rgb ? 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.45)' : '';
      var b = s.attributes.brightness;
      var p = s.attributes.percentage;
      sub.textContent = !on ? 'Off' : b ? Math.round(b / 2.55) + '%' : p ? p + '%' : 'On';
    });
    if (r.thermostat) renderThermo(r.thermostat.entity);
  }

  // ---- desk coach (FP2 desk zone history + live state)
  var deskSpans = [];   // [startMs, endMs|null] for today
  function midnight() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function loadDesk() {
    if (!cfg.desk || !ha.connected) return;
    var start = midnight();
    ha.call('history/history_during_period', {
      start_time: start.toISOString(), entity_ids: [cfg.desk.presence], minimal_response: true, no_attributes: true
    }).then(function (r) {
      var rows = r[cfg.desk.presence] || [];
      var spans = [];
      var open = null;
      rows.forEach(function (row) {
        var t = Math.max(start.getTime(), (row.lu || row.lc || 0) * 1000);
        if (row.s === 'on' && open == null) open = t;
        if (row.s !== 'on' && open != null) { spans.push([open, t]); open = null; }
      });
      if (open != null) spans.push([open, null]);
      deskSpans = spans;
      renderDesk();
    }).catch(function () { /* keep the last spans */ });
  }
  function onDeskChange() {
    var s = st(cfg.desk.presence);
    if (!s) return;
    var last = deskSpans[deskSpans.length - 1];
    var openSpan = last && last[1] == null;
    if (s.state === 'on' && !openSpan) deskSpans.push([Date.now(), null]);
    if (s.state !== 'on' && openSpan) last[1] = Date.now();
    renderDesk();
  }
  function renderDesk() {
    var el = $('tDesk');
    if (!el || !cfg.desk) return;
    var now = Date.now();
    var total = 0;
    deskSpans.forEach(function (sp) { total += ((sp[1] || now) - sp[0]) / 60000; });
    var last = deskSpans[deskSpans.length - 1];
    var sitting = last && last[1] == null;
    var session = sitting ? (now - last[0]) / 60000 : 0;
    var away = !sitting && last ? (now - last[1]) / 60000 : null;
    var brk = cfg.desk.breakAfterMin;
    var pct = Math.min(100, session / brk * 100);
    var co2 = num(cfg.air.co2);
    var desk = st(cfg.room.tiles[0].entity);
    var tip;
    if (sitting && session >= brk) tip = 'Time to <i>stand up and stretch.</i>';
    else if (co2 != null && co2 >= 1000) tip = 'CO₂ is at ' + Math.round(co2) + '. <i>Crack a window.</i>';
    else if (!sitting && desk && desk.state === 'on' && away != null && away > 15) tip = 'Desk light is on, <i>nobody’s here.</i>';
    else if (sitting) tip = 'Focus block. <i>Break at ' + clockText(new Date(last[0] + brk * 60000)) + '.</i>';
    else tip = total > 0 ? 'Nice. <i>' + deskSpans.length + ' sitting' + (deskSpans.length === 1 ? '' : 's') + ' so far today.</i>' : 'Desk is free. <i>Fresh start.</i>';
    el.innerHTML = '<div class="label">Desk time · today</div>' +
      '<div class="desk-row"><span class="desk-big num">' + dur(total) + '</span>' +
        '<span class="desk-sub">' + (sitting ? 'This sitting <b>' + dur(session) + '</b>' : away != null ? 'Away for <b>' + dur(away) + '</b>' : 'Not at the desk yet') +
        '<br>Break every <b>' + brk + ' min</b></span></div>' +
      '<div class="desk-bar"><i class="' + (pct >= 100 ? 'warn' : '') + '" style="width:' + pct + '%"></i></div>' +
      '<div class="desk-tip">' + tip + '</div>';
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
    var doing = a.hvac_action && a.hvac_action !== 'idle' && a.hvac_action !== 'off' ? a.hvac_action : (s.state === 'heat_cool' ? 'auto' : s.state);
    mode.innerHTML = round(a.current_temperature) + '° now · <span class="mode-' + esc(s.state) + '">' + esc(doing) + '</span>';
    var target = pendingTemp[id] != null ? pendingTemp[id] : a.temperature;
    tgt.className = tgt.className.replace(/ ?(cooling|heating)/g, '') + (a.hvac_action === 'cooling' ? ' cooling' : a.hvac_action === 'heating' ? ' heating' : '');
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
    $('view-chores').innerHTML = '<div class="chores"><div class="ch-head"><div class="ch-title" id="chTitle"></div></div><div class="ch-list" id="chList"></div></div>';
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
    var days = Math.floor((d - midnight()) / 86400000);
    var label = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow'
      : days < 7 ? DAYS[d.getDay()].slice(0, 3) : (d.getMonth() + 1) + '/' + d.getDate();
    return '<span class="due' + (days < 0 ? ' late' : '') + '">' + label + '</span>';
  }
  function renderTodo() {
    var open = todoItems.filter(function (i) { return i.status === 'needs_action'; });
    $('chTitle').innerHTML = esc(cfg.todoTitle || 'Chores') + ' <i>' + open.length + ' left</i>';
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
    return '<button class="h-row" ' + attrs + '>' + icon + '<div class="n">' + esc(name) + '<span ' + subAttr + '>–</span></div></button>';
  }
  function buildHome() {
    var doors = cfg.locks.map(function (l) {
      return row('data-lock="' + l.entity + '" data-name="' + esc(l.name) + '"', '<span data-icon="' + l.entity + '">' + I.lock + '</span>', l.name, 'data-sub="' + l.entity + '"');
    }).join('');
    if (cfg.garage) doors += row('data-garage="' + cfg.garage.entity + '"', I.garage, cfg.garage.name, 'data-sub="' + cfg.garage.entity + '"');
    var status = cfg.status.map(function (s) {
      return '<div class="h-row" data-status="' + s.entity + '">' + (I[s.icon] || I.drive) + '<div class="n">' + esc(s.name) +
        '</div><span class="val num" data-sv="' + s.entity + '">–</span></div>';
    }).join('');
    var thermos = cfg.thermostats.map(function (t) {
      return '<div class="h-row" data-thermo="' + t.entity + '">' + I.thermo + '<div class="n">' + esc(t.name) +
        '<span data-mode="' + t.entity + '">–</span></div><button class="round" data-step="-1">–</button>' +
        '<span class="val num" style="width:70px;text-align:center" data-target="' + t.entity + '">–</span>' +
        '<button class="round" data-step="1">+</button></div>';
    }).join('');
    var covers = cfg.homeCovers.map(function (c) {
      return '<div class="h-row" data-cover="' + c.entity + '">' + I.blind + '<div class="n">' + esc(c.name) +
        '<span data-sub="' + c.entity + '">–</span></div><button class="btn" data-tilt="open">Open</button>' +
        '<button class="btn" data-tilt="close">Close</button></div>';
    }).join('');
    $('view-home').innerHTML = '<div class="home">' +
      '<div class="h-col"><div class="label h-label">Doors</div>' + doors + '<div class="label h-label gap">Status</div>' + status + '</div>' +
      '<div class="h-col"><div class="label h-label">Climate</div>' + thermos + '</div>' +
      '<div class="h-col"><div class="label h-label">Blinds</div>' + covers + '</div>' +
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

  // ------------------------------------------------------------------ time-of-day accent
  // From sun.sun: within 6° of the horizon is sunrise (rising) or sunset; below -6° is night.
  function renderSky() {
    var sun = st('sun.sun');
    var phase;
    if (sun && sun.attributes.elevation != null) {
      var el = sun.attributes.elevation;
      phase = el < -6 ? 'night' : el < 6 ? (sun.attributes.rising ? 'sunrise' : 'sunset') : 'day';
    } else {
      var h = new Date().getHours();
      phase = h < 6 || h >= 20 ? 'night' : h < 8 ? 'sunrise' : h >= 18 ? 'sunset' : 'day';
    }
    var cls = 'stage sky-' + phase;
    if ($('stage').className !== cls) $('stage').className = cls;
  }

  // ------------------------------------------------------------------ clock loop
  var lastMinute = -1;
  function tick() {
    var now = new Date();
    var h = now.getHours();
    var dim = cfg.dimFrom != null && (cfg.dimFrom > cfg.dimUntil ? (h >= cfg.dimFrom || h < cfg.dimUntil) : (h >= cfg.dimFrom && h < cfg.dimUntil));
    $('night').className = 'night' + (dim ? ' on' : '');
    renderAges();
    refreshSnapshots(false);
    if (now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      renderClock(now);
      renderSky();
      renderWeather();
      renderDesk();
      if (lastMinute % 10 === 0) { loadNews(); loadOutside(); }
      if (lastMinute % 5 === 0) loadDesk();
      if (h === 0 && lastMinute === 0) deskSpans = [];
    }
    // Fresh page once a day at 3:00, to keep a long-running WebView lean.
    if (h === 3 && now.getMinutes() === 0 && now.getSeconds() < 2 && performance.now() > 120000) location.reload();
  }

  // ------------------------------------------------------------------ wiring
  function watched() {
    var r = cfg.room;
    var A = cfg.air;
    var ids = [cfg.weather, 'sun.sun', cfg.todo, r.temperature, r.thermostat && r.thermostat.entity, A.pm25, A.co2, A.voc, A.nox, A.humidity,
      cfg.desk && cfg.desk.presence];
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
    renderAir();
    renderHome();
    if (cfg.desk && changed.indexOf(cfg.desk.presence) >= 0) onDeskChange();
    if (changed.indexOf(cfg.weather) >= 0) renderWeather();
    if (changed.indexOf('sun.sun') >= 0) renderSky();
    var todo = st(cfg.todo);
    if (todo && todo.state !== lastTodoState) { lastTodoState = todo.state; if (current === 'chores') loadTodo(); }
    var firstSnap = cfg.cameras.some(function (c) { return changed.indexOf(c.entity) >= 0 && !snapAt[c.entity]; });
    if (firstSnap) refreshSnapshots(true);
  });
  ha.onConnect(function () {
    ha.call('get_config').then(function (c) { home = c; loadOutside(); }).catch(function () {});
    loadDesk();
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
  renderAir();
  renderDesk();
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
