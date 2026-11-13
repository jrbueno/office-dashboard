// Tiles-design settings. Copy to config.js (git-ignored) next to this file and fill in your own entities.
//   cp designs/tiles/config.example.js designs/tiles/config.js
// The token comes from secrets.js, which deploy.sh writes from ~/.config/hass-frame-token.
// Every entity id below is a placeholder: replace each with one from your Home Assistant.
window.DASHBOARD_CONFIG = {
  haUrl: 'https://homeassistant.example.com',
  clock24h: false,
  // 'auto' follows sun.sun (dark after sunset), or force 'light' / 'dark'.
  theme: 'auto',
  // Dim the screen between these hours (24h). Set both to null to disable.
  dimFrom: 23,
  dimUntil: 6,

  weather: 'weather.home',
  // Outdoor air from Open-Meteo (plain HTTP; the frame lacks some HTTPS roots). Location comes from HA.
  airPlace: 'Home',
  // Hacker News front page via Algolia (CORS-enabled, GlobalSign root).
  newsUrl: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=3',

  room: {
    name: 'Office',
    temperature: 'sensor.room_temperature',
    humidity: 'sensor.room_humidity',
    co2: 'sensor.air_monitor_co2',
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
