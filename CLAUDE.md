# Salida Weather Dashboard

A static HTML weather + webcam dashboard for a wall-mounted display in Salida, CO. Hosted on GitHub Pages, loaded by Chromium in kiosk mode on a Raspberry Pi Zero 2 W driving a cheap 10" HDMI monitor.

Goal: glance up, see current conditions, look outside via the Tenderfoot Mountain PTZ cam, see what the next 10 days look like. No interactivity, no settings, no auth.

## Hardware target

- **Pi:** Raspberry Pi Zero 2 W (quad-core ARM Cortex-A53 @ 1GHz, 512MB RAM)
- **OS:** Raspberry Pi OS Lite (Bookworm, 32-bit, May 2025 release)
- **Browser:** Chromium in kiosk mode (fullscreen, no UI chrome)
- **Display:** Loncevon 10.1" HDMI monitor, display-only (no touch)
  - Native resolution: either **1024×600** or **1280×800** — TBD, confirm on first run
- **Network:** 2.4GHz WiFi

## Performance constraints

The Pi Zero 2 W is modest. Build accordingly:

- **No build step.** Plain HTML/CSS/JS. No transpilation, no bundling, no `package.json`. Easier deploy, easier debug, easier iterate.
- **No frameworks.** Vanilla JS only. React/Vue/etc. are wasteful here.
- **No CDN font loading** if avoidable. System fonts are fine. Self-host any webfont if absolutely required.
- **Lightweight icons.** Inline SVG preferred. If using an icon library, pick something small (e.g., a few Tabler Icons inlined, not the full font).
- **No animations** beyond basic fades. No render loops.
- **Static layout.** No drag, resize, or scroll.
- **The page lives on screen for weeks.** No memory leaks. Be careful with detached DOM nodes, growing arrays, and event listener accumulation.

## Layout

Three panels in a fixed grid:

```
┌────────────────────────┬──────────────────────────┐
│                        │                          │
│  Current Conditions    │   Webcam Feed (4:3)      │
│  (top-left)            │   (top-right)            │
│                        │                          │
├────────────────────────┴──────────────────────────┤
│                                                   │
│              10-Day Forecast                      │
│              (bottom, full width)                 │
│                                                   │
└───────────────────────────────────────────────────┘
```

Approximate proportions:
- Top row: ~60% of viewport height
- Bottom row: ~40% of viewport height
- Top split: roughly 17:15 width ratio (gives the webcam panel a usable 4:3 aspect, since the source is 1280×960)

Use CSS Grid. Don't make it responsive — it lives on a single fixed-resolution screen.

## Data sources

### Webcam

- **Source:** Tenderfoot Mountain PTZ, Salida, CO
- **Provider:** coloradowebcam.net
- **Snapshot URL:** `https://coloradowebcam.net/webcam/salidatower3/current.jpg`
- **Native resolution:** 1280×960 (4:3)
- **Strategy:** Replace `<img>` `src` every ~4 seconds with a cache-busted URL:

```js
cam.src = 'https://coloradowebcam.net/webcam/salidatower3/current.jpg?t=' + Date.now();
```

- **Failure handling:** Use the `<img>` `onerror` handler to keep the last-good image visible — don't show a broken-image icon. Optionally show a small "stale" indicator if no successful load in N seconds.

### Weather (Open-Meteo)

- **No API key required.** Free with generous limits. https://open-meteo.com
- **Location:** Salida, CO — `lat=38.5366, lng=-105.9923`, elevation 7,083 ft
- **Refresh interval:** every 15 minutes
- **Suggested endpoint:**

```
https://api.open-meteo.com/v1/forecast?latitude=38.5366&longitude=-105.9923&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FDenver&forecast_days=10
```

- **Weather codes:** Open-Meteo returns WMO weather codes (0 = clear, 1–3 = mainly clear/partly cloudy/overcast, 45/48 = fog, 51–67 = drizzle/rain, 71–77 = snow, 80–82 = showers, 95–99 = thunderstorm). Need a translation table mapping each code to friendly text + an icon.
- **Failure handling:** Cache last successful response in memory; if a refresh fails, keep showing previous data and the last-updated timestamp.

## Content

### Current Conditions panel (top-left)

- Small-caps header: location name + elevation ("SALIDA, CO · 7,083 FT")
- Big temperature (~64px, regular weight)
- Conditions description ("Partly cloudy") + "Feels like X°" to the right
- Today's high / low
- Secondary metrics grid (3 columns × 3 rows): Wind, Humidity, UV, Dew point, Pressure, Visibility, AQI(?), Sunrise, Sunset

### Webcam panel (top-right)

- Full-bleed `<img>`, `object-fit: contain` (try contain first to avoid cropping the 4:3 source on a wider panel)
- Small "LIVE" badge top-left (red dot + text)
- Caption bottom-left: "Tenderfoot Mtn PTZ · [current time]"

### 10-Day Forecast strip (bottom)

- 10 equal-width columns
- Each column: day name ("Today", "Thu", "Fri"…), weather icon, high/low temps
- Today's column subtly emphasized (bolder day name)
- Subtle vertical dividers between days

## Visual style

- Light theme. Designed for daytime visibility.
- System UI font: `system-ui, -apple-system, "Segoe UI", sans-serif`
- Restrained palette:
  - Backgrounds: off-white `#fafaf7`, white `#ffffff`
  - Text: near-black `#222`, dark gray `#333`, medium `#666`–`#888` for secondary
  - Accents: warm red `#c44` for highs, cool blue `#4a78a0` for lows
- Weather icons: simple, single-color SVG. Tabler Icons (https://tabler.io/icons) inlined is a clean option.

## File structure

```
salida-dashboard/
├── index.html
├── styles.css
├── app.js
└── README.md
```

Keep it three files plus README. No build, no package manager.

## Deployment

- **GitHub Pages** from the `main` branch (or `/docs` folder, whichever is configured)
- `git push` → live within ~1 minute
- Pi's Chromium will be pointed at the deployed URL
- Page handles its own refresh on timers — no full page reloads needed in normal operation

## Resilience requirements

- Both data sources can and will fail. Neither failure should disrupt the dashboard.
- No data should ever disappear from the screen because of a failed fetch — always keep showing the last good value.
- The Pi runs for weeks between reboots. No accumulating event listeners, no growing arrays, no memory leaks. Validate this by checking `performance.memory` if possible during dev.

## Out of scope (v1)

- Touch interaction
- Settings UI
- Multiple locations or webcams
- Service worker / offline support (the page can't function offline — both data sources require internet)
- Dark mode toggle
- Hourly forecast detail
- Local data (Arkansas River flow, snowpack, AQI) — possible v2 additions

## Open questions (need verification on actual hardware)

1. **Actual screen resolution** — confirm 1024×600 vs 1280×800 once the dashboard is up on the Pi. Adjust CSS accordingly.
2. **Webcam refresh interval** — 4 seconds is a guess. May need to back off if coloradowebcam.net rate-limits. Watch network tab.
3. **Open-Meteo response shape** — confirm exact field names and structure against a live API response. The API has been stable but always sanity-check.

## Coordinating with the human

The human is working on this in parallel with configuring the Pi side (Chromium kiosk autostart, HDMI tuning, etc.). Focus this project on the web side only — the Pi infrastructure is being handled separately.
