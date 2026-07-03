# VoiceGuide

Turn any screen recording into a fully narrated tutorial — in your own cloned voice — in under a minute.

Record your screen, let AI watch it and write the script, edit the steps, then download a finished MP4 with your voice reading the narration synced to the right timestamps.

---

## Features

- **Voice cloning** — clone your voice from a 2–3 minute audio sample via Fish Audio (free)
- **Voice library** — save multiple named voices, switch between them any time
- **Screen recording** — capture any screen or window directly in the browser
- **AI script generation** — Claude vision watches your keyframes and writes a step-by-step narration script focused only on what your cursor is doing
- **Editable steps** — review and tweak every line before narration is generated
- **Tone selector** — Enthusiastic, Explanatory, Friendly, Professional, Concise, or Beginner-friendly
- **TTS narration** — Fish Audio synthesises each step in your cloned voice
- **MP4 export** — ffmpeg mixes all audio clips over your screen recording at the right timestamps

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + Zustand |
| Backend | Express + TypeScript |
| Frame extraction & muxing | ffmpeg |
| Vision AI | Claude Haiku (Anthropic) — batches all keyframes in one call |
| Voice cloning & TTS | Fish Audio API |
| State persistence | Zustand + localStorage |

---

## Prerequisites

- Node 22+
- ffmpeg — `brew install ffmpeg`
- API keys (see Environment Variables below)

---

## Local setup

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Configure environment
cp .env.example server/.env
# Fill in your keys in server/.env

# 3. Start the servers (two terminals)
cd server && npm run dev        # API — http://localhost:3001
cd client && npm run dev        # App — http://localhost:5173
```

Open **http://localhost:5173**

---

## Environment variables

Create `server/.env` with the following:

```
ANTHROPIC_API_KEY=        # Claude vision for script generation
FISH_AUDIO_API_KEY=       # Voice cloning + TTS
ALLOWED_ORIGINS=http://localhost:5173   # comma-separated in production
PORT=3001
```

API keys are server-side only and never reach the browser.

---

## Pipeline

```
Browser (MediaRecorder)
  → screen.webm uploaded to Express
  → ffmpeg extracts 1 frame every 5s → JPEG keyframes
  → Claude Haiku vision sees all frames at once → writes [STEP N] narration script
  → User reviews and edits steps
  → Fish Audio TTS → per-step MP3 files (in your cloned voice)
  → ffmpeg mixes audio clips over screen recording with per-step adelay
  → MP4 download
```

---

## App flow

| Page | Route | What happens |
|---|---|---|
| Voice library | `/onboarding` | Clone your voice, name it, manage saved voices |
| Context | `/setup` | Set title, description, audience and tone |
| Record | `/record` | Start screen recording, stop to process |
| Review | `/review` | Edit steps, generate narration per-step, preview audio |
| Export | `/export` | Render and download the final MP4 |

---

## Project structure

```
voicetutorial/
├── client/
│   └── src/
│       ├── pages/          Onboarding, Setup, Record, Review, Export
│       ├── components/     VoiceSampleRecorder, VideoContextForm, ScriptEditor, VideoPreview, BackButton
│       ├── store/          useStore.ts — Zustand global state + localStorage persistence
│       └── lib/            api.ts — typed fetch helpers
└── server/
    └── src/
        ├── routes/         voice.ts, recording.ts, export.ts
        ├── services/       fishaudio.ts, scriptGen.ts, ffmpeg.ts
        └── middleware/     upload.ts (multer)
```

---

## Deploying

**Client → Vercel**
- Root directory: `client`
- Build command: `npm run build`
- Output: `dist`
- Environment variable: `VITE_API_URL=https://your-server.up.railway.app`

**Server → Railway**
- Root directory: `server`
- Railway reads `nixpacks.toml` which installs ffmpeg automatically
- Add all environment variables in the Railway dashboard
- Set `ALLOWED_ORIGINS` to your Vercel URL

---

## Dev commands

```bash
# Type check
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# Production build
cd server && npm run build
cd client && npm run build
```

---

## Roadmap

- Re-render a single step without redoing all narration
- Subtitle / caption burn-in option
- Branded intros and outros
- Multi-language TTS output
- Tutorial library — browse and re-export past recordings
- Shareable hosted links
