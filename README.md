# Salida Weather Dashboard

Static, dependency-free wall-display dashboard for Salida, CO. Designed to run in
Chromium kiosk mode on a Raspberry Pi Zero 2 W.

- **Hosting:** GitHub Pages (this repo)
- **Data:** Open-Meteo (weather), coloradowebcam.net (Tenderfoot Mtn PTZ)
- **No build step.** Plain HTML/CSS/JS. Edit, push, refresh.

## Files

| File         | Purpose                                       |
| ------------ | --------------------------------------------- |
| `index.html` | Markup + grid layout                          |
| `styles.css` | Fixed-resolution layout, light theme          |
| `app.js`     | Weather fetch (15m), webcam refresh (4s)      |

## Local preview

Just open `index.html` in a browser. No server needed.

```sh
# optional, if a file:// origin trips a CORS quirk
python -m http.server 8000
```

## Deploying via GitHub Pages

1. Push to `main`.
2. Repo Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/`.
3. URL becomes `https://<user>.github.io/kitchendash/`.

Point the Pi's Chromium at that URL in kiosk mode.

## Tuning knobs (in `app.js`)

- `WEBCAM_INTERVAL_MS` (default 4000) — back off if the source rate-limits
- `WX_INTERVAL_MS` (default 15 min) — Open-Meteo free tier is generous
- `WEBCAM_STALE_MS` (default 60s) — when to show the "signal lost" badge

## Notes

- All fetches keep the last good payload on failure. The dashboard never
  blanks out because of a transient network issue.
- The page is meant to live on-screen for weeks. No accumulating listeners,
  no growing arrays. `renderDays` rebuilds off-DOM and swaps once via
  `replaceChildren`.
- Layout assumes a single fixed-resolution screen. Tweak `:root` padding and
  `.temp` font size for 1024×600 vs 1280×800 once the screen is confirmed.
