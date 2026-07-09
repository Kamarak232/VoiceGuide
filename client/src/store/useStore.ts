import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VideoContext {
  title: string;
  description: string;
  audience: string;
  tone: 'enthusiastic' | 'explanatory' | 'friendly' | 'professional' | 'concise' | 'beginner';
  keywords: string;
}

export interface ScriptSegment {
  stepNumber: number;
  text: string;
  videoStartTime: number;
  videoEndTime: number;
}

export interface SyncEntry {
  step: number;
  audioFile: string;
  audioDuration: number;
  videoStartTime: number;
}

export interface SavedVoice {
  id: string;
  name: string;
  createdAt: number;
}

interface Store {
  voiceId: string;
  setVoiceId: (id: string) => void;

  savedVoices: SavedVoice[];
  addVoice: (voice: SavedVoice) => void;
  removeVoice: (id: string) => void;

  videoContext: VideoContext;
  setVideoContext: (ctx: VideoContext) => void;

  sessionId: string;
  setSessionId: (id: string) => void;

  segments: ScriptSegment[];
  setSegments: (segs: ScriptSegment[]) => void;
  updateSegmentText: (stepNumber: number, text: string) => void;
  reorderSegments: (newOrder: number[]) => void;

  syncManifest: SyncEntry[];
  setSyncManifest: (m: SyncEntry[]) => void;
  updateSyncEntry: (entry: SyncEntry) => void;

  videoUrl: string;
  setVideoUrl: (url: string) => void;

  videoDuration: number;
  setVideoDuration: (d: number) => void;

  downloadUrl: string;
  setDownloadUrl: (url: string) => void;

  clearSession: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      voiceId: '',
      setVoiceId: (id) => set({ voiceId: id }),

      savedVoices: [],
      addVoice: (voice) =>
        set((s) => ({
          savedVoices: [voice, ...s.savedVoices.filter((v) => v.id !== voice.id)],
        })),
      removeVoice: (id) =>
        set((s) => ({
          savedVoices: s.savedVoices.filter((v) => v.id !== id),
          voiceId: s.voiceId === id ? '' : s.voiceId,
        })),

      videoContext: { title: '', description: '', audience: '', tone: 'explanatory', keywords: '' },
      setVideoContext: (ctx) => set({ videoContext: ctx }),

      sessionId: '',
      setSessionId: (id) => set({ sessionId: id }),

      segments: [],
      setSegments: (segs) => set({ segments: segs }),
      updateSegmentText: (stepNumber, text) =>
        set((s) => ({
          segments: s.segments.map((seg) =>
            seg.stepNumber === stepNumber ? { ...seg, text } : seg
          ),
        })),
      reorderSegments: (newOrder) =>
        set((s) => {
          const segMap = new Map(s.segments.map((seg) => [seg.stepNumber, seg]));
          const syncMap = new Map(s.syncManifest.map((e) => [e.step, e]));
          const newSegments = newOrder.map((oldStep, i) => ({
            ...segMap.get(oldStep)!,
            stepNumber: i + 1,
          }));
          const newSyncManifest = newOrder
            .map((oldStep, i) => {
              const entry = syncMap.get(oldStep);
              return entry ? { ...entry, step: i + 1 } : null;
            })
            .filter((e): e is SyncEntry => e !== null);
          return { segments: newSegments, syncManifest: newSyncManifest };
        }),

      syncManifest: [],
      setSyncManifest: (m) => set({ syncManifest: m }),
      updateSyncEntry: (entry) =>
        set((s) => ({
          syncManifest: s.syncManifest.map((e) => (e.step === entry.step ? entry : e)),
        })),

      videoUrl: '',
      setVideoUrl: (url) => set({ videoUrl: url }),

      videoDuration: 0,
      setVideoDuration: (d) => set({ videoDuration: d }),

      downloadUrl: '',
      setDownloadUrl: (url) => set({ downloadUrl: url }),

      clearSession: () => set({
        voiceId: '',
        savedVoices: [],
        sessionId: '',
        segments: [],
        syncManifest: [],
        videoUrl: '',
        videoDuration: 0,
        downloadUrl: '',
        videoContext: { title: '', description: '', audience: '', tone: 'explanatory', keywords: '' },
      }),
    }),
    { name: 'voicetutorial-store' }
  )
);
