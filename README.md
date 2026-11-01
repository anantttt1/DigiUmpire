# DigiUmpire 🏏

**Smart Cricket Scoring & Umpire Assistant PWA**

A modern, mobile-first cricket scoring web app that works offline and can be installed as a native-like app on your phone.

## Features

- **Live Scoring** – Runs (0–6), Wickets, Extras (Wide, No-ball, Bye, Leg-bye)
- **Overs & Balls** tracking with automatic over completion
- **Players Management** – Add batsmen & bowlers, set team names & total overs
- **Striker / Non-striker** tracking + partnership
- **Run Rate, Balls Left, Extras** stats
- **Undo** last action
- **Ball-by-ball History**
- **Camera Tools**
  - Live camera with Wide-line & Crease (No-ball) overlays
  - Approximate Ball Speed Estimator (timer-based)
  - Quick Wide / No-ball call buttons
- **PWA** – Install on Android / iOS, works offline
- **Local Storage** – Match state auto-saved

## How to Use

1. Open the app → **Players** tab → set Team names, Overs, add players → **Save & Start**
2. Use the big scoring buttons on the main screen
3. **Camera** tab → Start Camera → use guides + speed timer
4. Install as App: browser will show “Install” banner (or use browser menu → Add to Home Screen)

## Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and login with GitHub
2. Click **Add New Project** → Import `anantttt1/DigiUmpire`
3. Deploy (no build command needed – static site)
4. Your live URL will be ready in seconds

## Local Development

Just open `index.html` in a modern browser, or use any static server:

```bash
npx serve .
```

## Tech

- Pure HTML / CSS / JS (no framework)
- Service Worker for offline
- Web App Manifest for installability
- getUserMedia for camera

---

Made for umpires, scorers & cricket lovers.
