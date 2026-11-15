// Office HQ settings. Copy to config.js (git-ignored), fill in your own entities, then run office/deploy.sh.
//   cp office/config.example.js office/config.js
// The token comes from secrets.js, which deploy.sh writes from ~/.config/hass-frame-token.
// Every entity id below is a placeholder: replace each with one from your Home Assistant.
window.DASHBOARD_CONFIG = {
  haUrl: 'https://homeassistant.example.com',
  clock24h: false,
  // Dim the screen between these hours (24h). Set both to null to disable.
  dimFrom: 23,
  dimUntil: 6,

  weather: 'weather.home',
  place: 'Home',
  // Hacker News front page via Algolia (CORS-enabled, GlobalSign root): stories with points and comments.
  newsUrl: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
  // HN's own front-page order (Firebase, same GlobalSign-signed chain). Leave out to order by points only.
  newsRankUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',

  // Header: outside air (Open-Meteo, plain HTTP; location from HA) vs an indoor air monitor (e.g. Apollo AIR-1).
  air: {
    pm25: 'sensor.air_monitor_pm_2_5',
    co2: 'sensor.air_monitor_co2',
    voc: 'sensor.air_monitor_voc_index',
    nox: 'sensor.air_monitor_nox_index',
    // Use a separate room sensor if the monitor's own readings run warm.
    humidity: 'sensor.room_humidity',
  },

  room: {
    name: 'Office',
    temperature: 'sensor.room_temperature',
    thermostat: { entity: 'climate.office', name: 'Office' },
    tiles: [
      { entity: 'light.desk', name: 'Desk light', icon: 'bulb' },
      { entity: 'light.lamp', name: 'Lamp', icon: 'lamp' },
      { entity: 'fan.tower_fan', name: 'Tower fan', icon: 'fan' },
      { entity: 'switch.ceiling_fan', name: 'Ceiling fan', icon: 'fan' },
    ],
    scenes: [
      { entity: 'scene.office_bright', name: 'Bright' },
      { entity: 'scene.office_dimmed', name: 'Dimmed' },
      { entity: 'scene.office_night', name: 'Night' },
      { off: ['light.desk', 'light.lamp'], name: 'All off' },
    ],
  },
  todayCamera: 'camera.front_door',

  // Calendars for the Calendar view (month / week) and Today's bottom-right "Up next". Any HA calendar works;
  // an ICS feed goes in as a Remote Calendar. color = chip and dot colour (6-digit hex).
  calendars: [
    { entity: 'calendar.family', name: 'Family', color: '#E8A33D' },
    { entity: 'calendar.school', name: 'School', color: '#2FA36B' },
  ],
  // Up next: how many days ahead to look and how many events to show.
  agenda: { days: 14, max: 4 },


  // Chores view
  todo: 'todo.chores',
  todoTitle: 'Chores',

  // Cameras view (snapshot grid; tap one for the live stream)
  cameras: [
    { entity: 'camera.front_door', name: 'Front door' },
    { entity: 'camera.driveway', name: 'Driveway' },
    { entity: 'camera.backyard', name: 'Backyard' },
  ],
  snapshotSeconds: 10,
  snapshotWidth: 480,

  // Home view (house-wide)
  locks: [
    { entity: 'lock.front_door', name: 'Front door' },
  ],
  garage: { entity: 'cover.garage_door', name: 'Garage door' },
  thermostats: [
    { entity: 'climate.downstairs', name: 'Downstairs' },
    { entity: 'climate.upstairs', name: 'Upstairs' },
  ],
  homeCovers: [
    { entity: 'cover.living_room_blinds', name: 'Living room' },
  ],
  status: [
    { entity: 'sensor.nas_volume_used', name: 'NAS volume', warnAbove: 85, alertAbove: 95, unit: '%' },
    { entity: 'sensor.nas_status', name: 'NAS status', okStates: ['normal'] },
    { entity: 'binary_sensor.attic_leak', name: 'Attic leak', icon: 'drop', okStates: ['off'], labels: { off: 'Dry', on: 'LEAK' } },
  ],
};
