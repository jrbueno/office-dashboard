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
    if (view === 'calendar') loadCal();
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
      '<div class="card t-news"><div class="hn-bar"><span class="hn-y">Y</span><b>Hacker News</b><span id="newsLabel">top 10</span><small id="newsAge"></small>' +
        '<button class="hn-more" data-go="news">All stories ›</button></div>' +
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
      '<div class="t-agenda" id="tAgenda"></div>' +
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
  // Up to 30 front-page stories from Algolia (one request, with points and comments). Algolia returns them by
  // points; HN's own order comes from its Firebase top-stories list, so each story gets a .rank from there.
  var news = [];
  var newsRanked = false;
  var newsAt = null;
  var NEWS_SORTS = { rank: 'front page', points: 'most points', 'new': 'newest' };
  var newsSort = 'rank';
  try { var ns = localStorage.getItem('newsSort'); if (NEWS_SORTS[ns]) newsSort = ns; } catch (e) { /* default */ }
  function loadNews() {
    if (!cfg.newsUrl) return;
    var rankP = cfg.newsRankUrl ? getJSON(cfg.newsRankUrl).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([getJSON(cfg.newsUrl), rankP]).then(function (res) {
      var ids = res[1] || [];
      newsRanked = ids.length > 0;
      news = (res[0].hits || []).map(function (h) {
        var r = ids.indexOf(+h.objectID);
        h.rank = r < 0 ? 9999 : r + 1;
        return h;
      });
      newsAt = new Date();
      renderNews();
    }).catch(function (e) {
      if (news.length) return;
      var msg = '<div class="news-empty">Headlines unavailable (' + esc(e.message) + ').</div>';
      $('newsList').innerHTML = msg;
      if ($('nvList')) $('nvList').innerHTML = msg;
    });
  }
  function sortedNews() {
    // Without HN's list (it failed to load), "front page" falls back to points.
    var mode = newsSort === 'rank' && !newsRanked ? 'points' : newsSort;
    return news.slice().sort(function (a, b) {
      return mode === 'rank' ? a.rank - b.rank : mode === 'new' ? b.created_at_i - a.created_at_i : (b.points || 0) - (a.points || 0);
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
  function newsItem(n, i) {
    return '<div class="news-i"><span class="news-n num">' + (i + 1) + '</span><div class="news-t"><b>' + esc(n.title) + '</b>' +
      // Job posts carry no points or comments.
      '<span>' + (n.points != null ? '<em>' + n.points + ' pts</em> · ' : '<em>job</em> · ') + esc(host(n.url)) +
      (n.num_comments != null ? ' · ' + n.num_comments + ' comments' : '') + ' · ' + ago(n.created_at) + '</span></div></div>';
  }
  function renderNews() {
    if (!news.length) return;
    var list = sortedNews();
    var label = NEWS_SORTS[newsSort === 'rank' && !newsRanked ? 'points' : newsSort];
    $('newsList').innerHTML = list.slice(0, 10).map(newsItem).join('');
    $('newsLabel').textContent = label;
    $('newsAge').textContent = 'updated ' + clockText(newsAt);
    if (!$('nvList')) return;
    $('nvSwitch').className = 'news-switch is-' + newsSort;
    $('nvLabel').textContent = list.length + ' stories · ' + label;
    $('nvAge').textContent = 'updated ' + clockText(newsAt);
    $('nvList').innerHTML = list.map(newsItem).join('');
  }

  // ---- news view: the whole front page, with a Front page / Points / Newest switch (also orders the Today card)
  function buildNewsView() {
    $('view-news').innerHTML = '<div class="news-page">' +
      '<div class="hn-bar big"><span class="hn-y">Y</span><b>Hacker News</b><span id="nvLabel"></span>' +
        '<div class="news-switch" id="nvSwitch"><i class="knob"></i><button data-sort="rank">Front page</button><button data-sort="points">Points</button><button data-sort="new">Newest</button></div>' +
        '<small id="nvAge"></small></div>' +
      '<div class="news-list big" id="nvList"><div class="news-empty">Loading headlines…</div></div></div>';
  }
  $('view-news').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sort]');
    if (!b) return;
    newsSort = b.getAttribute('data-sort');
    try { localStorage.setItem('newsSort', newsSort); } catch (err) { /* fine */ }
    renderNews();
  });

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

  // ------------------------------------------------------------------ calendars (shared)
  // calendar.get_events over the socket: HA expands repeats and timezones (an ICS feed goes in as a Remote Calendar).
  var SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY_MS = 864e5;
  function midnight(d) { d = d ? new Date(d.getTime()) : new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function calList() { return cfg.calendars || []; }
  function calColor(i) { var c = calList()[i]; return (c && c.color) || '#8C877C'; }
  function tint(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  // All-day events come as 'YYYY-MM-DD' (end exclusive); timed ones as ISO with an offset.
  function evDate(v) {
    if (v.indexOf('T') < 0) { var p = v.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
    return new Date(v);
  }
  function fetchEvents(start, end) {
    var cals = calList();
    if (!cals.length) return Promise.resolve([]);
    if (!ha.connected) return Promise.reject(new Error('not connected'));
    return ha.call('call_service', {
      domain: 'calendar', service: 'get_events', return_response: true,
      target: { entity_id: cals.map(function (c) { return c.entity; }) },
      service_data: { start_date_time: start.toISOString(), end_date_time: end.toISOString() }
    }).then(function (r) {
      var resp = (r && r.response) || {};
      var list = [];
      cals.forEach(function (c, ci) {
        ((resp[c.entity] || {}).events || []).forEach(function (ev) {
          list.push({ s: evDate(ev.start), e: evDate(ev.end), allDay: ev.start.indexOf('T') < 0,
            title: ev.summary || '(no title)', where: ev.location || '', cal: ci });
        });
      });
      // By start; on the same day, all-day events first.
      list.sort(function (a, b) { return a.s - b.s || (b.allDay - a.allDay); });
      return list;
    });
  }
  function onDay(list, day) {
    var next = addDays(day, 1);
    return list.filter(function (ev) { return ev.s < next && ev.e > day; });
  }
  function spanDays(ev) { return Math.round((midnight(ev.e) - midnight(ev.s)) / DAY_MS); }
  function dayDiff(d) { return Math.round((midnight(d) - midnight()) / DAY_MS); }
  function dayLabel(d, long) {
    var n = dayDiff(d);
    if (n <= 0) return 'Today';
    if (n === 1) return long ? 'Tomorrow' : 'Tmrw';
    return SHORT_DAYS[d.getDay()] + ' ' + (long && n > 6 ? MONTHS[d.getMonth()].slice(0, 3) + ' ' : '') + d.getDate();
  }
  function timeText(d) { return clockText(d) + (cfg.clock24h ? '' : ' ' + ampm(d.getHours())); }
  // Compact time for calendar chips: 9a, 3:30p (or 09:00 / 15:30).
  function timeShort(d) {
    if (cfg.clock24h) return pad(d.getHours()) + ':' + pad(d.getMinutes());
    return hour12(d.getHours()) + (d.getMinutes() ? ':' + pad(d.getMinutes()) : '') + (d.getHours() < 12 ? 'a' : 'p');
  }
  function allDayText(ev, now) {
    var n = spanDays(ev);
    if (n <= 1) return 'All day';
    return ev.s <= now ? 'Until ' + SHORT_DAYS[addDays(ev.e, -1).getDay()] : n + ' days';
  }
  function legend(cls) {
    return calList().length < 2 ? '' : '<span class="' + cls + '">' + calList().map(function (c, i) {
      return '<span><i style="background:' + esc(calColor(i)) + '"></i>' + esc(c.name) + '</span>';
    }).join('') + '</span>';
  }

  // ---- up next (Today, bottom right)
  var agenda = null;   // null until the first load
  var agendaErr = '';
  function loadAgenda() {
    if (!calList().length || !ha.connected) return;
    var start = midnight();
    fetchEvents(start, addDays(start, (cfg.agenda && cfg.agenda.days) || 14)).then(function (list) {
      agenda = list; agendaErr = ''; renderAgenda();
    }).catch(function (e) {
      if (agenda == null) { agenda = []; agendaErr = e.message; renderAgenda(); }
    });
  }
  function heroWhen(ev, now) {
    if (ev.s <= now) return '<b>Now</b> · until ' + timeText(ev.e);
    var min = (ev.s - now) / 60000;
    if (ev.allDay) return '<b>' + dayLabel(ev.s, true) + '</b> · ' + allDayText(ev, now).toLowerCase();
    if (min < 180) return '<b>In ' + dur(min) + '</b> · ' + timeText(ev.s);
    return '<b>' + dayLabel(ev.s, true) + '</b> · ' + timeText(ev.s);
  }
  function calDot(ev) {
    return calList().length > 1 ? '<i class="ag-dot" style="background:' + esc(calColor(ev.cal)) + '"></i>' : '';
  }
  function renderAgenda() {
    var el = $('tAgenda');
    if (!el || !calList().length) return;
    var A = cfg.agenda || {};
    var now = new Date();
    var head = '<div class="ag-head"><span class="label">Up next</span>' + legend('ag-legend') + '<button class="ag-more" data-calday="month">Calendar ›</button></div>';
    if (agenda == null) { el.innerHTML = head + '<div class="ag-empty">Loading calendar…</div>'; return; }
    if (agendaErr) { el.innerHTML = head + '<div class="ag-empty">Calendar unavailable<small>' + esc(agendaErr) + '</small></div>'; return; }
    var live = agenda.filter(function (ev) { return ev.e > now; });
    if (!live.length) { el.innerHTML = head + '<div class="ag-empty">Nothing in the next ' + (A.days || 14) + ' days.</div>'; return; }
    // The big slot goes to the next thing that happens at a time, not an all-day event already under way.
    var hi = -1;
    for (var i = 0; i < live.length; i++) { if (!(live[i].allDay && live[i].s <= now)) { hi = i; break; } }
    var hero = hi >= 0 ? live[hi] : null;
    var rest = live.filter(function (ev, j) { return j !== hi; }).slice(0, (A.max || 4) - (hero ? 1 : 0));
    var soon = hero && !hero.allDay && hero.s > now && hero.s - now < 15 * 60000;
    el.innerHTML = head +
      (hero ? '<button class="ag-hero' + (soon ? ' soon' : '') + '" data-calday="' + midnight(hero.s).getTime() + '"><div class="ag-when">' + heroWhen(hero, now) + (hero.where ? ' · ' + esc(hero.where.split(',')[0]) : '') + '</div>' +
        '<div class="ag-title">' + calDot(hero) + esc(hero.title) + '</div></button>' : '') +
      '<div class="ag-rows">' + rest.map(function (ev) {
        var ongoing = ev.s <= now;
        return '<button class="ag-row" data-calday="' + midnight(ongoing ? now : ev.s).getTime() + '"><span class="ag-day' + (dayDiff(ev.s) <= 0 || ongoing ? ' is-today' : '') + '">' + (ongoing ? 'Today' : dayLabel(ev.s)) + '</span>' +
          '<span class="ag-time num">' + (ev.allDay ? allDayText(ev, now) : timeText(ev.s)) + '</span>' +
          '<span class="ag-name">' + calDot(ev) + esc(ev.title) + '</span></button>';
      }).join('') + '</div>';
  }

  // ---- calendar view (month grid, or a week of day columns; the switch slides between them)
  var calMode = 'month';
  try { calMode = localStorage.getItem('calMode') === 'week' ? 'week' : 'month'; } catch (e) { /* default */ }
  var calAnchor = midnight();
  var calEvents = null;   // events for the range on screen
  var calKey = '';
  function calRange() {
    if (calMode === 'week') { var w = addDays(calAnchor, -calAnchor.getDay()); return [w, addDays(w, 7)]; }
    var first = new Date(calAnchor.getFullYear(), calAnchor.getMonth(), 1);
    var start = addDays(first, -first.getDay());
    var days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return [start, addDays(start, Math.ceil((first.getDay() + days) / 7) * 7)];
  }
  function buildCalendar() {
    $('view-calendar').innerHTML = '<div class="cal">' +
      '<div class="cal-head"><div class="cal-title" id="calTitle"></div>' + legend('cal-legend') +
        '<div class="cal-switch" id="calSwitch"><i class="knob"></i><button data-mode="month">Month</button><button data-mode="week">Week</button></div>' +
        '<button class="round" data-nav="-1">‹</button><button class="btn cal-today" data-nav="0">Today</button><button class="round" data-nav="1">›</button></div>' +
      '<div class="cal-body" id="calBody"></div></div>';
  }
  function loadCal() {
    var r = calRange();
    var key = calMode + r[0].getTime();
    if (key !== calKey) { calKey = key; calEvents = null; renderCal(); }
    fetchEvents(r[0], r[1]).then(function (list) {
      if (key !== calKey) return;   // the user moved on while this loaded
      calEvents = list; renderCal();
    }).catch(function (e) {
      if (key === calKey && calEvents == null) $('calBody').innerHTML = '<div class="cal-msg">Calendar unavailable<small>' + esc(e.message) + '</small></div>';
    });
  }
  function chip(ev, day) {
    var col = calColor(ev.cal);
    if (ev.allDay) {
      // A multi-day event shows its title on its first day (and each Sunday); the other days get a bar.
      var first = ev.s >= day || day.getDay() === 0;
      return '<div class="chip all" style="background:' + tint(col, 0.22) + ';border-left-color:' + col + '">' + (first ? esc(ev.title) : '&nbsp;') + '</div>';
    }
    // A timed event carried over from an earlier day (a trip, a rental) reads as a bar, not a new start time.
    if (ev.s < day) return '<div class="chip all" style="background:' + tint(col, 0.12) + ';border-left-color:' + col + '">↳ ' + esc(ev.title) + '</div>';
    return '<div class="chip"><i style="background:' + col + '"></i><b>' + timeShort(ev.s) + '</b> ' + esc(ev.title) + '</div>';
  }
  function renderCal() {
    var el = $('calBody');
    if (!el) return;
    var sw = $('calSwitch');
    sw.className = 'cal-switch is-' + calMode;
    var r = calRange();
    var today = midnight();
    var a = calAnchor;
    if (calMode === 'month') {
      $('calTitle').innerHTML = MONTHS[a.getMonth()] + ' <i>' + a.getFullYear() + '</i>';
    } else {
      var last = addDays(r[1], -1);
      $('calTitle').innerHTML = MONTHS[r[0].getMonth()].slice(0, 3) + ' ' + r[0].getDate() + ' – ' +
        (last.getMonth() !== r[0].getMonth() ? MONTHS[last.getMonth()].slice(0, 3) + ' ' : '') + last.getDate() + ' <i>' + last.getFullYear() + '</i>';
    }
    var list = calEvents || [];
    var heads = SHORT_DAYS.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('');
    var html = '';
    if (calMode === 'month') {
      var weeks = Math.round((r[1] - r[0]) / DAY_MS / 7);
      var maxChips = weeks > 5 ? 3 : 4;
      for (var d = r[0]; d < r[1]; d = addDays(d, 1)) {
        var evs = onDay(list, d);
        var shown = evs.slice(0, evs.length > maxChips ? maxChips - 1 : maxChips);
        html += '<button class="cal-cell' + (d.getMonth() !== a.getMonth() ? ' out' : '') + (+d === +today ? ' is-today' : '') +
          (d.getDay() === 0 || d.getDay() === 6 ? ' wkend' : '') + '" data-day="' + d.getTime() + '"><span class="cal-n num">' + d.getDate() + '</span>' +
          shown.map(function (ev) { return chip(ev, d); }).join('') +
          (evs.length > shown.length ? '<div class="chip more">+' + (evs.length - shown.length) + ' more</div>' : '') + '</button>';
      }
      el.className = 'cal-body month';
      el.innerHTML = '<div class="cal-dows">' + heads + '</div><div class="cal-grid" style="grid-template-rows:repeat(' + weeks + ',1fr)">' + html + '</div>';
    } else {
      var now = new Date();
      for (var w = r[0]; w < r[1]; w = addDays(w, 1)) {
        var dayEvs = onDay(list, w);
        html += '<div class="wk-col' + (+w === +today ? ' is-today' : '') + (w < today ? ' past' : '') + '">' +
          '<div class="wk-head"><span>' + SHORT_DAYS[w.getDay()] + '</span><b class="num">' + w.getDate() + '</b></div><div class="wk-list">' +
          (dayEvs.length ? dayEvs.map(function (ev) {
            var col = calColor(ev.cal);
            if (ev.allDay) return '<div class="wk-ev all" style="background:' + tint(col, 0.22) + ';border-left-color:' + col + '">' + esc(ev.title) + '</div>';
            // Times that fall on another day name that day: "7p–Sun 4:25p", "Continues · until 4:25p".
            var endTxt = (ev.e <= addDays(w, 1) ? '' : SHORT_DAYS[ev.e.getDay()] + ' ') + timeShort(ev.e);
            var when = ev.s < w ? 'Continues · until ' + endTxt : timeShort(ev.s) + '–' + endTxt;
            return '<div class="wk-ev' + (ev.e <= now ? ' done' : '') + (ev.s < w ? ' cont' : '') + '" style="border-left-color:' + col + '"><small class="num">' + when + '</small>' +
              esc(ev.title) + (ev.where ? '<em>' + esc(ev.where.split(',')[0]) + '</em>' : '') + '</div>';
          }).join('') : '<div class="wk-none">—</div>') + '</div></div>';
      }
      el.className = 'cal-body week';
      el.innerHTML = '<div class="wk">' + html + '</div>';
    }
    if (calEvents == null) el.className += ' loading';
  }
  function calSetMode(mode) {
    calMode = mode;
    try { localStorage.setItem('calMode', mode); } catch (e) { /* fine */ }
    loadCal();
  }
  function calStep(n) {
    if (n === 0) calAnchor = midnight();
    else if (calMode === 'week') calAnchor = addDays(calAnchor, 7 * n);
    else calAnchor = new Date(calAnchor.getFullYear(), calAnchor.getMonth() + n, 1);
    loadCal();
  }
  $('view-calendar').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var mode = b.getAttribute('data-mode');
    if (mode) { if (mode !== calMode) calSetMode(mode); return; }
    var nav = b.getAttribute('data-nav');
    if (nav != null) { calStep(+nav); return; }
    // Tapping a day in the month opens its week.
    var day = b.getAttribute('data-day');
    if (day) { calAnchor = new Date(+day); calSetMode('week'); }
  });
  // Swipe left/right on the calendar for next/previous.
  var swipeX = null;
  $('view-calendar').addEventListener('touchstart', function (e) { swipeX = e.touches[0].clientX; }, { passive: true });
  $('view-calendar').addEventListener('touchend', function (e) {
    if (swipeX == null) return;
    var dx = e.changedTouches[0].clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 80) calStep(dx < 0 ? 1 : -1);
  }, { passive: true });
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
    var to = t.getAttribute('data-go');
    if (to) { go(to); return; }
    var calDay = t.getAttribute('data-calday');
    if (calDay) {
      // "Calendar ›" opens this month; an Up next event opens its week.
      calAnchor = calDay === 'month' ? midnight() : new Date(+calDay);
      calMode = calDay === 'month' ? 'month' : 'week';
      go('calendar');
      return;
    }
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
      renderAgenda();
      if (lastMinute % 10 === 0) { loadNews(); loadOutside(); loadAgenda(); if (current === 'calendar') loadCal(); }
    }
    // Fresh page once a day at 3:00, to keep a long-running WebView lean.
    if (h === 3 && now.getMinutes() === 0 && now.getSeconds() < 2 && performance.now() > 120000) location.reload();
  }

  // ------------------------------------------------------------------ wiring
  function watched() {
    var r = cfg.room;
    var A = cfg.air;
    var ids = [cfg.weather, 'sun.sun', cfg.todo, r.temperature, r.thermostat && r.thermostat.entity, A.pm25, A.co2, A.voc, A.nox, A.humidity];
    [r.tiles, calList(), cfg.cameras, cfg.locks, cfg.thermostats, cfg.homeCovers, cfg.status].forEach(function (list) {
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
    // A calendar entity's state flips when an event starts or ends: refetch so the list moves on.
    if (calList().some(function (c) { return changed.indexOf(c.entity) >= 0; })) { loadAgenda(); if (current === 'calendar') loadCal(); }
    if (changed.indexOf(cfg.weather) >= 0) renderWeather();
    if (changed.indexOf('sun.sun') >= 0) renderSky();
    var todo = st(cfg.todo);
    if (todo && todo.state !== lastTodoState) { lastTodoState = todo.state; if (current === 'chores') loadTodo(); }
    var firstSnap = cfg.cameras.some(function (c) { return changed.indexOf(c.entity) >= 0 && !snapAt[c.entity]; });
    if (firstSnap) refreshSnapshots(true);
  });
  ha.onConnect(function () {
    ha.call('get_config').then(function (c) { home = c; loadOutside(); }).catch(function () {});
    loadAgenda();
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
  buildCalendar();
  buildNewsView();
  buildChores();
  buildCameras();
  buildHome();
  renderAir();
  renderAgenda();
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
