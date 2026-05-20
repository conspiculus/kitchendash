/* Salida Weather Dashboard
   Vanilla JS, no build, no deps. Designed to run on a Pi Zero 2 W for weeks.
   - Webcam: refresh <img> src every WEBCAM_INTERVAL_MS, keep last-good on error.
   - Weather: fetch Open-Meteo every WX_INTERVAL_MS, keep last-good on error.
   - Clock: minute tick for cam caption + day rollover.
*/

(() => {
  'use strict';

  const LAT = 38.5366;
  const LON = -105.9923;
  const TZ = 'America/Denver';

  const WEBCAM_URL = 'https://coloradowebcam.net/webcam/salidatower3/current.jpg';
  const WEBCAM_INTERVAL_MS = 4000;
  const WEBCAM_STALE_MS = 60_000;

  const WX_URL =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${LAT}&longitude=${LON}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,' +
    'pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,dew_point_2m,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,' +
    'precipitation_probability_max' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' +
    `&timezone=${encodeURIComponent(TZ)}&forecast_days=10`;
  const WX_INTERVAL_MS = 15 * 60 * 1000;
  const WX_RETRY_MS = 60 * 1000;

  /* ── Icons (inline SVGs, monoline). Re-used as strings. ───────────── */
  const ICON = {
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`,
    partly: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="9" r="3"/><path d="M8 3v1M8 14v1M3 9h1M12 9h1M4.6 5.6l.7.7M11.4 5.6l-.7.7M4.6 12.4l.7-.7"/><path d="M10 14a4 4 0 0 1 4 4h3a3 3 0 1 0-.6-5.9A5 5 0 0 0 10 14z"/></svg>`,
    partlyNight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4a4 4 0 0 0 5 5 4.5 4.5 0 1 1-5-5z"/><path d="M9 16a4 4 0 0 1 4 4h3a3 3 0 1 0-.6-5.9A5 5 0 0 0 9 16z"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4 4 0 0 1 .4-7.9 5 5 0 0 1 9.7 1.4A3.5 3.5 0 0 1 17 18z"/></svg>`,
    fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13a4 4 0 0 1 .4-7.9 5 5 0 0 1 9.7 1.4A3.5 3.5 0 0 1 17 13z"/><path d="M5 17h14M4 20h16"/></svg>`,
    rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13a4 4 0 0 1 .4-7.9 5 5 0 0 1 9.7 1.4A3.5 3.5 0 0 1 17 13z"/><path d="M9 16v3M13 16v4M17 16v3"/></svg>`,
    drizzle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13a4 4 0 0 1 .4-7.9 5 5 0 0 1 9.7 1.4A3.5 3.5 0 0 1 17 13z"/><path d="M9 17v1M13 17v2M17 17v1"/></svg>`,
    snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13a4 4 0 0 1 .4-7.9 5 5 0 0 1 9.7 1.4A3.5 3.5 0 0 1 17 13z"/><path d="M9 18l.01 0M13 19l.01 0M17 18l.01 0M11 17l.01 0M15 17l.01 0"/></svg>`,
    sleet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13a4 4 0 0 1 .4-7.9 5 5 0 0 1 9.7 1.4A3.5 3.5 0 0 1 17 13z"/><path d="M9 16v2M13 16v3M17 16v2M11 19l.01 0M15 19l.01 0"/></svg>`,
    storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13a4 4 0 0 1 .4-7.9 5 5 0 0 1 9.7 1.4A3.5 3.5 0 0 1 17 13z"/><path d="M11 15l-2 4h3l-2 4"/></svg>`,
  };

  /* WMO weather code → { label, icon, nightIcon? }
     https://open-meteo.com/en/docs */
  function describe(code, isDay) {
    const day = isDay !== 0;
    switch (code) {
      case 0:  return { label: 'Clear',           icon: day ? ICON.sun : ICON.moon };
      case 1:  return { label: 'Mostly Clear',    icon: day ? ICON.sun : ICON.moon };
      case 2:  return { label: 'Partly Cloudy',   icon: day ? ICON.partly : ICON.partlyNight };
      case 3:  return { label: 'Overcast',        icon: ICON.cloud };
      case 45: return { label: 'Fog',             icon: ICON.fog };
      case 48: return { label: 'Freezing Fog',    icon: ICON.fog };
      case 51: return { label: 'Light Drizzle',   icon: ICON.drizzle };
      case 53: return { label: 'Drizzle',         icon: ICON.drizzle };
      case 55: return { label: 'Heavy Drizzle',   icon: ICON.drizzle };
      case 56: return { label: 'Freezing Drizzle', icon: ICON.sleet };
      case 57: return { label: 'Freezing Drizzle', icon: ICON.sleet };
      case 61: return { label: 'Light Rain',      icon: ICON.rain };
      case 63: return { label: 'Rain',            icon: ICON.rain };
      case 65: return { label: 'Heavy Rain',      icon: ICON.rain };
      case 66: return { label: 'Freezing Rain',   icon: ICON.sleet };
      case 67: return { label: 'Freezing Rain',   icon: ICON.sleet };
      case 71: return { label: 'Light Snow',      icon: ICON.snow };
      case 73: return { label: 'Snow',            icon: ICON.snow };
      case 75: return { label: 'Heavy Snow',      icon: ICON.snow };
      case 77: return { label: 'Snow Grains',     icon: ICON.snow };
      case 80: return { label: 'Light Showers',   icon: ICON.rain };
      case 81: return { label: 'Showers',         icon: ICON.rain };
      case 82: return { label: 'Heavy Showers',   icon: ICON.rain };
      case 85: return { label: 'Snow Showers',    icon: ICON.snow };
      case 86: return { label: 'Snow Showers',    icon: ICON.snow };
      case 95: return { label: 'Thunderstorm',    icon: ICON.storm };
      case 96: return { label: 'Thunderstorm',    icon: ICON.storm };
      case 99: return { label: 'Thunderstorm',    icon: ICON.storm };
      default: return { label: '—',               icon: ICON.cloud };
    }
  }

  /* ── DOM cache ───────────────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const el = {
    temp: $('temp'), cond: $('cond'), feels: $('feels'),
    hi: $('hi'), lo: $('lo'),
    nowIcon: $('now-icon'),
    wind: $('wind'), humidity: $('humidity'), uv: $('uv'),
    dew: $('dew'), pressure: $('pressure'), cloud: $('cloud'),
    gusts: $('gusts'), sunrise: $('sunrise'), sunset: $('sunset'),
    stamp: $('wx-stamp'),
    cam: $('cam'), camTime: $('cam-time'), camStale: $('cam-stale'),
    days: $('days'),
  };

  /* ── Helpers ─────────────────────────────────────────────────────── */
  const fmtTemp = (n) => (n == null || Number.isNaN(n)) ? '—' : `${Math.round(n)}°`;
  const fmtInt  = (n, suffix = '') => (n == null || Number.isNaN(n)) ? '—' : `${Math.round(n)}${suffix}`;
  const fmtPressure = (hpa) => {
    if (hpa == null) return '—';
    const inHg = hpa * 0.02953;
    return `${inHg.toFixed(2)} inHg`;
  };
  const compass = (deg) => {
    if (deg == null) return '';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(((deg % 360) / 22.5)) % 16];
  };
  const fmtClock = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US',
      { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  };
  const nowClock = () =>
    new Date().toLocaleTimeString('en-US',
      { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  const dayName = (iso, idx) => {
    if (idx === 0) return 'Today';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ });
  };

  /* ── Webcam ──────────────────────────────────────────────────────── */
  let lastGoodCamLoad = 0;

  el.cam.addEventListener('load', () => {
    lastGoodCamLoad = Date.now();
    el.camStale.hidden = true;
  });
  el.cam.addEventListener('error', () => {
    // Leave existing image visible. Stale indicator handled by tick.
  });

  function refreshCam() {
    // Cache-bust per the spec.
    el.cam.src = `${WEBCAM_URL}?t=${Date.now()}`;
  }

  function camTick() {
    el.camTime.textContent = nowClock();
    if (lastGoodCamLoad && (Date.now() - lastGoodCamLoad) > WEBCAM_STALE_MS) {
      el.camStale.hidden = false;
    }
  }

  /* ── Weather ─────────────────────────────────────────────────────── */
  let wxRetryHandle = null;

  async function fetchWeather() {
    if (wxRetryHandle) { clearTimeout(wxRetryHandle); wxRetryHandle = null; }
    try {
      const res = await fetch(WX_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderWeather(data);
    } catch (err) {
      // Keep last-good. Show staleness via the timestamp footer.
      console.warn('weather fetch failed', err);
      el.stamp.textContent = (el.stamp.textContent || '').replace(/\(stale\)?$/, '').trim() +
        '  (stale)';
      wxRetryHandle = setTimeout(fetchWeather, WX_RETRY_MS);
    }
  }

  function renderWeather(data) {
    const c = data.current || {};
    const d = data.daily || {};

    const today = describe(c.weather_code, c.is_day);
    el.temp.textContent = fmtTemp(c.temperature_2m);
    el.cond.textContent = today.label;
    el.feels.textContent = fmtTemp(c.apparent_temperature);

    const hi = d.temperature_2m_max ? d.temperature_2m_max[0] : null;
    const lo = d.temperature_2m_min ? d.temperature_2m_min[0] : null;
    el.hi.textContent = fmtTemp(hi);
    el.lo.textContent = fmtTemp(lo);
    el.nowIcon.innerHTML = today.icon;

    const wd = compass(c.wind_direction_10m);
    el.wind.textContent = (c.wind_speed_10m == null)
      ? '—'
      : `${Math.round(c.wind_speed_10m)} mph ${wd}`.trim();
    el.gusts.textContent = fmtInt(c.wind_gusts_10m, ' mph');
    el.humidity.textContent = fmtInt(c.relative_humidity_2m, '%');
    el.uv.textContent = (c.uv_index == null) ? '—' : c.uv_index.toFixed(1);
    el.dew.textContent = fmtTemp(c.dew_point_2m);
    el.pressure.textContent = fmtPressure(c.pressure_msl);
    el.cloud.textContent = fmtInt(c.cloud_cover, '%');
    el.sunrise.textContent = fmtClock(d.sunrise && d.sunrise[0]);
    el.sunset.textContent  = fmtClock(d.sunset  && d.sunset[0]);

    renderDays(d);

    const updated = new Date().toLocaleTimeString('en-US',
      { hour: 'numeric', minute: '2-digit', timeZone: TZ });
    el.stamp.textContent = `Updated ${updated}`;
  }

  function renderDays(d) {
    if (!d || !d.time) return;
    const n = Math.min(10, d.time.length);
    // Build off-DOM, then replace once. Avoids accumulating handlers.
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const day = document.createElement('div');
      day.className = 'day' + (i === 0 ? ' today' : '');

      const name = document.createElement('div');
      name.className = 'dname';
      name.textContent = dayName(d.time[i], i);
      day.appendChild(name);

      const icon = document.createElement('div');
      icon.className = 'dicon';
      icon.innerHTML = describe(d.weather_code[i], 1).icon;
      day.appendChild(icon);

      const temps = document.createElement('div');
      temps.className = 'dtemps';
      const hi = d.temperature_2m_max ? d.temperature_2m_max[i] : null;
      const lo = d.temperature_2m_min ? d.temperature_2m_min[i] : null;
      temps.innerHTML =
        `<span class="dhi">${fmtTemp(hi)}</span>` +
        `<span class="dsep">·</span>` +
        `<span class="dlo">${fmtTemp(lo)}</span>`;
      day.appendChild(temps);

      const pop = document.createElement('div');
      pop.className = 'dpop';
      const p = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      pop.textContent = (p != null && p >= 10) ? `${Math.round(p)}%` : '';
      day.appendChild(pop);

      frag.appendChild(day);
    }
    el.days.replaceChildren(frag);
  }

  /* ── Boot ────────────────────────────────────────────────────────── */
  refreshCam();
  camTick();
  fetchWeather();

  setInterval(refreshCam, WEBCAM_INTERVAL_MS);
  setInterval(camTick, 30_000);
  setInterval(fetchWeather, WX_INTERVAL_MS);

  // Re-fetch weather when the tab regains focus (helps after sleep/wifi blip).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchWeather();
  });
})();
