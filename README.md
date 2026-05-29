# Great North Run 2026 - Countdown + Training Tracker

A self-contained web app for tracking training for the Great North Run, 13 September 2026.
No server, no accounts. All data lives in your browser's localStorage.

---

## Serving locally

You need to serve the files over HTTP (not just open `index.html` directly) so Safari
can read the manifest and the app installs correctly.

**Option A - Python (built into macOS):**
```
cd /path/to/great_run
python3 -m http.server 8080
```
Then open `http://localhost:8080` in Safari.

**Option B - Node (if you have it):**
```
npx serve /path/to/great_run -p 8080
```

**Option C - VS Code Live Server extension:**
Open the folder in VS Code and click "Go Live".

---

## Installing to your iPhone home screen

1. Make sure your Mac and iPhone are on the same Wi-Fi network.
2. Find your Mac's local IP address:
   - System Settings > Network > Wi-Fi > Details, or run `ifconfig | grep "inet "` in Terminal.
3. On your iPhone, open Safari and go to `http://<your-mac-ip>:8080`
   (e.g. `http://192.168.1.42:8080`).
4. Tap the Share button (box with arrow at the bottom of Safari).
5. Tap **Add to Home Screen**.
6. Name it "GNR 2026" and tap Add.

The app will now open full-screen from your home screen, looking like a native app.

---

## First launch

1. Set a 4-digit PIN (stored as a SHA-256 hash - this is a casual lock, not real security).
2. Answer two quick setup questions:
   - Your current comfortable longest run in miles (this is the starting point for your plan).
   - How many days a week you currently run.
3. You're in.

---

## Key features

- **Countdown** - weeks and days to race day, always visible on the home screen.
- **Training plan** - long run targets built from your current fitness, with taper. Tap Plan tab.
- **Daily check-in** - tick off good habits, flag bad ones. Tap Today tab.
- **Streak freeze** - earn one after 7 complete days; it auto-spends to protect your streak if you miss a day.
- **Calendar chain** - visual month view on the home screen so you can see the chain.
- **Route visualization** - your runner advances from Newcastle to South Shields as weeks pass. Tap Route tab.
- **Weekly recap** - tap the recap button on the home screen (or anytime from stats).
- **Settings** - gear icon on the home screen to update your longest run or days per week.
- **Reset everything** - on the PIN entry screen, or in settings.

---

## Data

All data is stored in `localStorage` with the prefix `gnr_`. To wipe everything,
use the "Reset everything" button in the app (behind two confirmation dialogs).

No data ever leaves your device.
