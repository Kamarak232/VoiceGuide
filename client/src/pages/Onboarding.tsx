import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceSampleRecorder from '../components/VoiceSampleRecorder';
import { useStore, SavedVoice } from '../store/useStore';
import { cloneVoice } from '../lib/api';
import { friendlyError } from '../lib/errors';

type CloneStatus = 'idle' | 'uploading' | 'naming' | 'error';

function isFishAudioId(id: string) {
  return /^[0-9a-f]{32}$/.test(id);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export default function Onboarding() {
  const navigate = useNavigate();
  const voiceId = useStore((s) => s.voiceId);
  const setVoiceId = useStore((s) => s.setVoiceId);
  const savedVoices = useStore((s) => s.savedVoices);
  const addVoice = useStore((s) => s.addVoice);
  const removeVoice = useStore((s) => s.removeVoice);

  const [cloneStatus, setCloneStatus] = useState<CloneStatus>('idle');
  const [cloneError, setCloneError] = useState('');
  const [pendingVoiceId, setPendingVoiceId] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [manualId, setManualId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const activeVoice = savedVoices.find((v) => v.id === voiceId);
  const hasValidVoice = !!(voiceId && isFishAudioId(voiceId) && activeVoice);
  const staleVoice = voiceId && !isFishAudioId(voiceId);

  async function handleCloneComplete(blob: Blob) {
    setCloneStatus('uploading');
    setCloneError('');
    try {
      const { voiceId: newId } = await cloneVoice(blob);
      setPendingVoiceId(newId);
      setVoiceName('My Voice');
      setCloneStatus('naming');
    } catch (e) {
      setCloneError(friendlyError(e));
      setCloneStatus('idle');
    }
  }

  function handleSaveVoice() {
    const name = voiceName.trim() || 'My Voice';
    const voice: SavedVoice = { id: pendingVoiceId, name, createdAt: Date.now() };
    addVoice(voice);
    setVoiceId(pendingVoiceId);
    setCloneStatus('idle');
    setPendingVoiceId('');
    setVoiceName('');
    setShowCloneForm(false);
  }

  function handleDeleteVoice(id: string) {
    removeVoice(id);
    setConfirmDelete(null);
  }

  function handleManualId() {
    const id = manualId.trim();
    if (!id) return;
    const voice: SavedVoice = { id, name: 'Imported Voice', createdAt: Date.now() };
    addVoice(voice);
    setVoiceId(id);
    setManualId('');
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold text-white mb-2">Voice library</h1>
      <p className="text-dim mb-10">Clone your voice and save it for reuse across all your tutorials.</p>

      {/* Stale voice warning */}
      {staleVoice && (
        <div className="mb-8 p-4 rounded-xl text-sm flex items-center justify-between gap-4"
          style={{ background: 'rgba(255,160,0,0.06)', border: '1px solid rgba(255,160,0,0.2)', color: 'rgba(255,200,80,0.9)' }}>
          <span>⚠ Saved voice is from a previous provider and won't work. Clone a new one.</span>
          <button onClick={() => setVoiceId('')} className="underline font-medium whitespace-nowrap">Clear</button>
        </div>
      )}

      {/* Saved voices */}
      {savedVoices.length > 0 && (
        <div className="mb-10">
          <p className="section-title mb-4">Saved voices</p>
          <div className="flex flex-col gap-3">
            {savedVoices.map((v) => {
              const isActive = v.id === voiceId;
              return (
                <div key={v.id}
                  className="flex items-center gap-4 p-4 rounded-xl transition-all"
                  style={{
                    background: isActive ? 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(180,77,255,0.05))' : 'rgba(255,255,255,0.02)',
                    border: isActive ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isActive ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" fill={isActive ? '#00d4ff' : 'rgba(255,255,255,0.4)'} />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M9 22h6" stroke={isActive ? '#00d4ff' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{v.name}</p>
                    <p className="hint-dark text-xs">{timeAgo(v.createdAt)} · <span className="font-mono">{v.id.slice(0, 8)}…</span></p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isActive ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                        Active
                      </span>
                    ) : (
                      <button onClick={() => setVoiceId(v.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#00d4ff'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      >
                        Use
                      </button>
                    )}

                    {confirmDelete === v.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteVoice(v.id)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(255,60,60,0.15)', color: 'rgba(255,100,100,0.9)', border: '1px solid rgba(255,60,60,0.2)' }}>
                          Delete
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(v.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                        style={{ color: 'rgba(255,255,255,0.2)', border: '1px solid transparent' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,100,100,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,60,60,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; e.currentTarget.style.borderColor = 'transparent'; }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Continue / add new */}
      {hasValidVoice && !showCloneForm && cloneStatus === 'idle' && (
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => navigate('/setup')} className="btn-neon">
            Continue with {activeVoice!.name} →
          </button>
          <button onClick={() => setShowCloneForm(true)}
            className="text-sm underline" style={{ color: 'rgba(255,255,255,0.35)' }}>
            + Clone a new voice
          </button>
        </div>
      )}

      {/* Clone form */}
      {(!hasValidVoice || showCloneForm) && cloneStatus !== 'naming' && (
        <div className="mb-10">
          <p className="section-title mb-1">{showCloneForm ? 'Clone a new voice' : 'Clone your voice'}</p>
          <p className="hint-dark mb-6">Record or upload 2–3 minutes of yourself speaking naturally.</p>

          {cloneStatus === 'idle' && <VoiceSampleRecorder onComplete={handleCloneComplete} />}

          {cloneStatus === 'uploading' && (
            <div className="card flex items-center gap-3 p-4">
              <div className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
                style={{ borderColor: 'rgba(0,212,255,0.8)', borderTopColor: 'transparent' }} />
              <span className="text-sm text-white/70">Cloning your voice with Fish Audio…</span>
            </div>
          )}

          {cloneError && (
            <div className="mt-4 p-4 rounded-xl text-sm"
              style={{ background: 'rgba(255,60,60,0.06)', border: '1px solid rgba(255,60,60,0.15)', color: 'rgba(255,120,120,0.9)' }}>
              {cloneError}
            </div>
          )}

          {showCloneForm && cloneStatus === 'idle' && (
            <button onClick={() => setShowCloneForm(false)} className="mt-4 text-sm underline"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Name the new voice */}
      {cloneStatus === 'naming' && (
        <div className="mb-10">
          <div className="card card-active p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,212,255,0.15)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Voice cloned successfully</p>
                <p className="hint-dark text-xs">Give it a name so you can find it later</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="label-dark text-xs">Voice name</label>
              <input
                autoFocus
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVoice(); }}
                placeholder="e.g. My Main Voice, UK Accent, Deep Voice…"
                className="input-dark"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSaveVoice} className="btn-neon">
                Save & continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual import */}
      {savedVoices.length === 0 && cloneStatus === 'idle' && (
        <>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="my-8" />
          <div>
            <p className="section-title">Or paste a Fish Audio model ID</p>
            <p className="hint-dark mb-4">Already have a voice on fish.audio? Paste its model ID here.</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="32-character model ID"
                className="input-dark flex-1"
              />
              <button onClick={handleManualId} disabled={!manualId.trim()} className="btn-ghost px-4 py-2 text-sm">
                Import
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
