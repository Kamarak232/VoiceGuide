import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import ScriptEditor from '../components/ScriptEditor';
import VideoPreview from '../components/VideoPreview';
import { synthesiseStep, renderExport } from '../lib/api';
import { useState } from 'react';
import { ScriptSegment, SyncEntry } from '../store/useStore';
import BackButton from '../components/BackButton';

type NarrationStatus = 'idle' | 'generating' | 'done' | 'error';

export default function Review() {
  const navigate = useNavigate();
  const segments = useStore((s) => s.segments);
  const syncManifest = useStore((s) => s.syncManifest);
  const sessionId = useStore((s) => s.sessionId);
  const voiceId = useStore((s) => s.voiceId);
  const videoUrl = useStore((s) => s.videoUrl);
  const updateSegmentText = useStore((s) => s.updateSegmentText);
  const updateSyncEntry = useStore((s) => s.updateSyncEntry);
  const setSyncManifest = useStore((s) => s.setSyncManifest);
  const setDownloadUrl = useStore((s) => s.setDownloadUrl);

  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus>('idle');
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [narrationError, setNarrationError] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState('');

  const hasNarration = syncManifest.length > 0 && syncManifest.length === segments.length;

  async function handleGenerateNarration(fromScratch = false) {
    if (!voiceId) {
      setNarrationError('No voice set up. Go to Voice Setup first.');
      return;
    }
    setNarrationStatus('generating');
    setNarrationError('');

    const existing = fromScratch ? [] : [...syncManifest];
    const doneSteps = new Set(existing.map((e) => e.step));
    setNarrationProgress(existing.length);

    const entries: SyncEntry[] = [...existing];
    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (doneSteps.has(seg.stepNumber)) continue;
        const result = await synthesiseStep(seg.text, voiceId, sessionId, seg.stepNumber);
        entries.push({
          step: seg.stepNumber,
          audioFile: result.audioFile,
          audioDuration: result.audioDuration,
          videoStartTime: seg.videoStartTime,
        });
        setNarrationProgress(entries.length);
      }
      setSyncManifest(entries);
      setNarrationStatus('done');
    } catch (e) {
      setSyncManifest(entries);
      setNarrationError(e instanceof Error ? e.message : 'Narration generation failed. Click Generate to retry remaining steps.');
      setNarrationStatus('error');
    }
  }

  async function handleRegenerateAudio(seg: ScriptSegment) {
    const result = await synthesiseStep(seg.text, voiceId, sessionId, seg.stepNumber);
    updateSyncEntry({
      step: seg.stepNumber,
      audioFile: result.audioFile,
      audioDuration: result.audioDuration,
      videoStartTime: seg.videoStartTime,
    });
  }

  async function handleRender() {
    setRendering(true);
    setRenderError('');
    try {
      const { downloadUrl } = await renderExport(sessionId, syncManifest, videoUrl);
      setDownloadUrl(downloadUrl);
      navigate('/export');
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : 'Render failed.');
      setRendering(false);
    }
  }

  if (!segments.length) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-dim">
        No recording processed yet.{' '}
        <button className="underline text-neon" onClick={() => navigate('/record')}>
          Go record →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <BackButton to="/record" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Script</h2>
          <p className="text-sm text-dim mb-6">
            Click any step to edit it before generating narration.
          </p>

          <ScriptEditor
            segments={segments}
            syncManifest={syncManifest}
            onUpdateText={updateSegmentText}
            onRegenerateAudio={handleRegenerateAudio}
          />

          <div className="mt-8 flex flex-col gap-3">
            {!hasNarration && narrationStatus !== 'generating' && (
              <button onClick={() => handleGenerateNarration()} className="btn-neon">
                Generate Narration →
              </button>
            )}

            {narrationStatus === 'generating' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
                  <span className="text-sm font-medium text-white/80">
                    Synthesising step {narrationProgress} of {segments.length}…
                  </span>
                </div>
                <div className="w-full rounded-full h-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: `${(narrationProgress / segments.length) * 100}%`,
                      background: 'linear-gradient(90deg, #00d4ff, #b44dff)',
                      boxShadow: '0 0 8px rgba(0,212,255,0.6)',
                    }}
                  />
                </div>
              </div>
            )}

            {narrationError && (
              <p className="text-sm" style={{ color: 'rgba(255,120,120,0.9)' }}>{narrationError}</p>
            )}

            {hasNarration && (
              <>
                <button
                  onClick={handleRender}
                  disabled={rendering}
                  className="btn-neon"
                  style={rendering ? {} : {
                    background: 'linear-gradient(135deg, rgba(180,77,255,0.2), rgba(0,212,255,0.1))',
                    borderColor: 'rgba(180,77,255,0.5)',
                    boxShadow: '0 0 20px rgba(180,77,255,0.2)',
                  }}
                >
                  {rendering ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#b44dff', borderTopColor: 'transparent' }} />
                      Rendering final video…
                    </span>
                  ) : 'Render Final Video →'}
                </button>
                <button
                  onClick={() => handleGenerateNarration(true)}
                  className="self-start text-xs text-dim hover:text-white underline transition-colors"
                >
                  Re-generate all narration
                </button>
                {renderError && <p className="text-sm" style={{ color: 'rgba(255,120,120,0.9)' }}>{renderError}</p>}
              </>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-6">Preview</h2>
          {videoUrl ? (
            <VideoPreview videoUrl={videoUrl} syncManifest={syncManifest} />
          ) : (
            <p className="text-dim text-sm">No video available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
