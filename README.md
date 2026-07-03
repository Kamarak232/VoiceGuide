# VoiceGuide

AI tutorial narrator for course sellers and coaches. Record your screen once — get back a narrated MP4 in your own cloned voice, with editable steps.

---

## What it does

1. You record your screen performing a task
2. AI watches the recording, extracts key moments, and writes a narration script
3. You edit the script if needed
4. Your cloned voice reads the script, synced to the right timestamps
5. You download a finished narrated MP4

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + Zustand |
| Backend | Express + TypeScript (ts-node-dev) |
| Frame extraction & muxing | ffmpeg |
| Vision AI | Ollama — moondream (frame description) + gemma4:e4b (script writing) |
| TTS | ElevenLabs (`eleven_monolingual_v1`) |
| State persistence | Zustand + localStorage |

---

## Prerequisites

- Node 22+ and npm
- ffmpeg (`brew install ffmpeg`)
- Ollama (`brew install ollama`) with two models pulled:
  ```bash
  ollama pull moondream
  ollama pull gemma4:e4b
  ```
- ElevenLabs account (free tier works)

---

## Setup

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

Create `server/.env`:

```
ELEVENLABS_API_KEY=your_key_here
```

### 3. Start Ollama

```bash
ollama serve
```

### 4. Start the servers

```bash
# Terminal 1 — API server (port 3001)
cd server && npm run dev

# Terminal 2 — Client (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173**

---

## Pipeline

```
Browser (MediaRecorder)
  → screen.webm uploaded to Express (multer)
  → ffmpeg extracts 1 frame every 5s → JPEG frames
  → moondream describes each frame (Ollama, local)
  → gemma4 writes [STEP N] narration script from descriptions (Ollama, local)
  → User reviews + edits steps
  → ElevenLabs TTS → per-step MP3 files
  → ffmpeg muxes audio clips over screen recording (adelay + atrim)
  → MP4 download
```

---

## App flow

| Page | Route | Purpose |
|---|---|---|
| Voice Setup | `/onboarding` | Pick a built-in voice or clone your own |
| Context | `/setup` | Title, description, audience, tone for the script |
| Record | `/record` | Start/stop screen recording |
| Review | `/review` | Edit steps, generate narration, preview audio |
| Export | `/export` | Download the final MP4 |

---

## Project structure

```
voicetutorial/
├── client/
│   └── src/
│       ├── pages/          Onboarding, Setup, Record, Review, Export
│       ├── components/     ScriptEditor, VideoPreview, VideoContextForm, BackButton
│       ├── store/          useStore.ts — Zustand global state
│       └── lib/            api.ts — typed fetch wrappers
└── server/
    └── src/
        ├── routes/         recording.ts, voice.ts, export.ts
        ├── services/       ffmpeg.ts, elevenlabs.ts, scriptGen.ts
        └── middleware/     upload.ts (multer)
```

---

## Key decisions

**Local AI (Ollama) instead of cloud vision**
moondream + gemma4 run entirely on your machine — zero per-request cost, no data leaves your computer.

**Timestamp anchoring**
Each narration step is anchored to the actual frame timestamp it was derived from, not evenly distributed across the video duration.

**Overlap prevention**
Each audio clip is trimmed with `atrim=duration=X` so it can never bleed into the next step's window.

**Narration retry is resumable**
If step 4 of 7 fails, completed steps are saved. Clicking Generate again skips steps that already have audio.

**WebM duration fallback**
Browser `MediaRecorder` WebM files often have no duration header. If ffprobe returns 0, the server falls back to `last_frame_timestamp + 5s`.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `ELEVENLABS_API_KEY` | Yes | Free tier works — standard TTS only |

API keys are server-side only and never sent to the browser.

---

## Dev commands

```bash
# Type-check
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# Build for production
cd server && npm run build
cd client && npm run build
```

---

## Health check

`GET http://localhost:3001/health` returns:

```json
{ "ok": true, "ollama": true }
```

`ollama: false` means Ollama is not running — the client shows a warning banner automatically.

---

## Roadmap (v2 ideas)

- Re-render a single step without redoing all narration
- Branded intros / outros and captions
- Multi-language output
- Tutorial library — browse past recordings
- Shareable hosted links (Loom-style)
- Cloud AI option (Claude Sonnet vision) for better frame accuracy
