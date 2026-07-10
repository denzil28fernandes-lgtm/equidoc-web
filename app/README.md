# EquiDoc — Demo

A runnable demo of the EquiDoc mobile flow, ported from the Claude Design
prototype (`EquiDoc.dc.html`) to React + Vite. Built to show the team the full
user journey on a Mac and on real phones.

## What it is
Six screens, faithful to the design:
1. **Language** — pick from 11 languages (RTL supported)
2. **Capture + consent** — camera viewfinder with a privacy consent gate
3. **Processing** — Reading → Translating → Simplifying
4. **Result** — spoken audio player, plain-language summary, key facts,
   "worth paying attention to" clause flags, an "ask a question" chat, and an
   "I understand / not sure" comprehension check
5. **Retake** — poor-photo guidance
6. **Done** — outcome + quick feedback

## What's real vs. mocked
- **Real:** camera capture (`getUserMedia`, with a gallery fallback) → the photo
  is sent to a local dev-server proxy (`/api/analyze` in `vite.config.js`) that
  calls **Gemini** and returns a structured, translated summary. The **audio
  actually speaks** the returned script via the browser's free Web Speech API
  (rate follows the 1× / 🐢 toggle), and the **chat** ("ask a question") is a
  live Gemini call (`/api/chat`) grounded in the analyzed document.
- **Mocked:** if no `GEMINI_API_KEY` is set (or a call fails), the result screen
  falls back to a built-in sample so the flow still demos end-to-end. TTS uses
  the on-device Web Speech voice rather than Cloud TTS.

> Needs a key: copy `.env.example` to `.env.local` and add your `GEMINI_API_KEY`
> (see below). The key stays server-side — it's read by the proxy and never
> shipped to the browser bundle.

## Run it

```bash
cd "app"
npm install
npm run dev
```

Vite prints two URLs:
- **Local:**   `http://localhost:5173`  ← open on your Mac
- **Network:** `http://192.168.x.x:5173` ← open this on a **phone** on the same
  Wi-Fi to demo the real mobile experience (spoken audio works there too).

> Tip: Web Speech voices come from the device/OS. Chrome and Safari on macOS/iOS
> and Chrome on Android all have voices installed by default. If no voice is
> present the player still animates — it just won't speak.

## Build a static bundle (optional, for hosting/sharing)

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built bundle, also with --host
```
