# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before any work

**Read `PRD.md` first.** All decisions — what to build, what to skip, what to defer — are governed by the PRD. Build one milestone at a time in order. Do not implement anything from a later milestone while an earlier one is incomplete.

## Commands

```bash
# Server (Terminal 1) — http://localhost:3000
cd server && npm run dev

# Client (Terminal 2) — http://localhost:5173
cd client && npm run dev

# Type-check (both)
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# Build
cd server && npm run build
cd client && npm run build
```

## Architecture

```
voicetutorial/
├── client/          React 18 + Vite + TypeScript + Tailwind + Zustand
│   └── src/
│       ├── pages/   One file per route (Onboarding, Setup, Record, Review, Export)
│       ├── store/   Zustand global state
│       ├── lib/     API client helpers
│       └── components/
└── server/          Express + TypeScript (ts-node-dev in dev)
    └── src/
        ├── routes/  recording.ts, voice.ts, export.ts
        ├── services/  ffmpeg.ts, elevenlabs.ts, scriptGen.ts, assemblyai.ts
        └── middleware/  upload.ts (multer)
```

**Pipeline:** browser `MediaRecorder` → upload to Express (multer) → ffmpeg extracts keyframes (scene-change filter) → Claude vision turns keyframes into numbered steps → ElevenLabs TTS in creator's cloned voice → ffmpeg muxes audio + video → MP4 download.

## Env vars (server/.env)

```
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ASSEMBLYAI_API_KEY=
```

API keys must never reach the browser (F10).

## Stack constraints

- **Screen capture:** `navigator.mediaDevices.getDisplayMedia()` + `MediaRecorder` — no OS-level event capture (web app limitation, intentional).
- **Keyframe extraction:** `ffmpeg select='gt(scene,X)'` — scene-change filter, not uniform sampling. Minimises Claude vision calls (cost control).
- **Claude model:** Sonnet with vision. Batch multiple keyframes per call.
- **Voice clone + TTS:** ElevenLabs PVC / instant clone → stored `voice_id` per creator, reused across tutorials.
- **Muxing:** server-side ffmpeg only.

## PRD milestones

| # | What | Status |
|---|------|--------|
| M1 | Screen record + local download (frontend only) | — |
| M2 | Upload + ffmpeg keyframe extraction (backend) | — |
| M3 | Claude vision → numbered steps (text only) | — |
| M4 | Editable steps UI | — |
| M5 | ElevenLabs voice clone + TTS | — |
| M6 | ffmpeg mux + MP4 export | — |
| M7 | Polish: progress states, errors, delete recording | — |

**Update the status column as milestones complete.** Never start M(n+1) until M(n) is done and verifiable end-to-end.

## Key PRD rules to hold

- Failures at any pipeline stage (upload, extract, narrate, TTS, mux) must surface a clear error — never silently lose the recording (NFR reliability).
- Show progress states at every async step — never a blank spinner (NFR performance).
- Recordings must be deletable by the user; do not retain longer than needed (NFR privacy).
- The editable-steps stage (M4 / F5) is the accuracy safety net — treat AI output as a draft.
