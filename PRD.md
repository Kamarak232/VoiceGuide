# PRD — VoiceGuide (working title)

**AI tutorial narrator for course sellers and coaches.**
Records a screen walkthrough, watches what happens, and produces a step-by-step narrated tutorial spoken in the creator's own cloned voice.

---

## 1. Problem

Course creators and coaches spend hours making "how to" tutorials: screen recording, then writing a script, then re-recording voiceover, then editing. Most hate the voiceover step — it's slow, they fluff their lines, and re-recording for one small change means redoing the whole thing.

They want to just *do the task once on screen* and get back a clean, narrated walkthrough in their own voice, with editable steps.

## 2. Target user

- Online course sellers (Teachable, Skool, Kajabi, Gumroad audiences)
- Coaches and consultants who deliver process-based training
- Agencies producing client SOPs and onboarding videos
- Solo creators selling "how I do X" tutorials

Primary persona: non-technical creator who can share their screen but does not want to script or record audio.

## 3. Core value proposition

> Record once. Get a finished tutorial narrated in your voice — no scriptwriting, no voiceover takes.

## 4. Product scope

### In scope (v1 / MVP)
- Browser-based screen recording (single screen / tab / window)
- One-time voice clone setup per creator
- AI-generated step-by-step narration from the recording (vision-based)
- TTS narration in the creator's cloned voice
- Export: narrated MP4 video
- Export: editable step list (text) the creator can tweak before final render

### Out of scope (v1)
- Real-time / live narration while recording
- OS-level click/keystroke capture (not possible in a web app)
- Multi-language narration
- Team accounts / collaboration
- In-app video editor / timeline trimming
- Mobile screen recording

### Likely v2
- Edit a step → re-render only that segment's audio
- Branded intros/outros and captions
- Multi-language output
- Library of saved tutorials
- Shareable hosted links (Loom-style)

## 5. User flow

1. **Onboard / clone voice** — creator records or uploads a short voice sample once; app stores a `voice_id`.
2. **Record** — creator clicks Record, picks the screen/tab/window to share, performs the task, clicks Stop.
3. **Process** — app uploads the recording, extracts keyframes, and Claude generates a numbered step script.
4. **Review steps** — creator sees the draft steps as editable text; can fix wording, merge, or delete steps.
5. **Generate narration** — app sends the (edited) script to TTS with the creator's `voice_id`.
6. **Render** — audio is muxed over the screen recording.
7. **Export** — creator downloads the narrated MP4 and/or the step list.

## 6. Functional requirements

| ID | Requirement |
|----|-------------|
| F1 | User can start/stop screen recording in-browser via `getDisplayMedia()` + `MediaRecorder`. |
| F2 | Recording is uploaded to the backend for processing. |
| F3 | Backend extracts keyframes, prioritising frames where the screen meaningfully changed (scene-change detection) over idle/duplicate frames. |
| F4 | Claude (vision) converts the keyframe sequence into clear numbered instructions ("First, open X. Then click Y and type Z."). |
| F5 | User can edit the generated step text before narration. |
| F6 | User can create a voice clone once; the `voice_id` is stored and reused across all future tutorials. |
| F7 | The edited script is converted to speech in the creator's cloned voice. |
| F8 | Narration audio is muxed over the original screen recording into a single MP4. |
| F9 | User can download the narrated MP4 and the step list as text. |
| F10 | API keys (Claude, TTS) are stored server-side only, never exposed to the browser. |

## 7. Non-functional requirements

- **Cost control:** narration generation must use scene-change filtering and batched frames to limit Claude vision calls. Track approx cost per tutorial.
- **Privacy:** recordings may contain sensitive screens (dashboards, client data). Recordings are processed and should be deletable by the user; do not retain longer than needed. State retention policy explicitly.
- **Performance:** a 3–5 minute recording should process in a reasonable time (target: under a couple of minutes end to end). Show progress states, never a blank spinner.
- **Reliability:** failures in any pipeline stage (upload, extract, narrate, TTS, mux) must surface a clear error and not lose the user's recording.

## 8. Technical architecture

**Frontend:** React (Vite)
**Backend:** FastAPI (Python)
**Screen capture:** `navigator.mediaDevices.getDisplayMedia()` + `MediaRecorder`
**Frame extraction & muxing:** ffmpeg (server-side)
**Narration intelligence:** Claude API (Sonnet, vision)
**Voice clone + TTS:** ElevenLabs (PVC / instant voice clone → `voice_id`)
**Storage:** temporary object storage for uploads + rendered outputs

### Pipeline
```
Browser screen share
  → record (MediaRecorder)
  → upload to FastAPI
  → ffmpeg: extract keyframes (scene-change filter)
  → Claude vision: keyframes → numbered step script
  → [user edits steps]
  → ElevenLabs: script + creator voice_id → narration audio
  → ffmpeg: mux audio over screen recording → MP4
  → download
```

### Why vision-based (not event-based)
A web app cannot observe activity outside the browser. It can only see the screen the user explicitly shares. So narration is inferred from frames, not from intercepted OS clicks/keystrokes. This is the correct and only approach for a web app, and it keeps the build native-code-free.

## 9. Cost & risk notes

- **Vision cost scales with frames.** Mitigate with scene-change detection (`ffmpeg select='gt(scene,X)'`) and batching multiple keyframes per Claude call.
- **Inference accuracy.** Vision infers actions; it won't always know exact button labels or typed values. The editable-steps stage (F5) is the safety net — treat the AI output as a draft, not final.
- **Voice clone consent/quality.** Creator must consent to cloning their own voice; quality depends on the sample. Provide guidance on a clean sample.
- **Sensitive screen content.** Surface a warning before recording and an easy delete after.

## 10. Build order (milestones)

| # | Milestone | Proves |
|---|-----------|--------|
| M1 | Screen record + local download (frontend only) | Capture works |
| M2 | Upload + ffmpeg keyframe extraction (backend) | Pipeline foundation |
| M3 | Claude vision → numbered steps (text only) | Core intelligence |
| M4 | Editable steps UI | Accuracy safety net |
| M5 | ElevenLabs voice clone + TTS | The differentiator |
| M6 | ffmpeg mux + MP4 export | Finished deliverable |
| M7 | Polish: progress states, errors, delete recording | Shippable |

## 11. Success metrics (post-launch)

- Time from stop-recording to finished tutorial
- % of generated steps kept without edits (narration quality proxy)
- Tutorials completed per creator per week
- Cost per tutorial (must stay below target margin)

## 12. Open questions

- Hosting model: download-only, or hosted shareable links like Loom?
- Free tier limits (minutes/tutorials per month)?
- Retention: how long are recordings kept before auto-delete?
- Pricing: per-seat subscription vs usage-based?
