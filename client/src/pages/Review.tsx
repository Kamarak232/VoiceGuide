import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import ScriptEditor from '../components/ScriptEditor';
import VideoPreview from '../components/VideoPreview';
import { synthesiseStep, renderExport, uploadStepRecording, previewStep } from '../lib/api';
import { friendlyError } from '../lib/errors';
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
  const reorderSegments = useStore((s) => s.reorderSegments);
  const updateSyncEntry = useStore((s) => s.updateSyncEntry);
  const setSyncManifest = useStore((s) => s.setSyncManifest);
  const setDownloadUrl = useStore((s) => s.setDownloadUrl);

  const videoContext = useStore((s) => s.videoContext);

  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus>('idle');
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [narrationError, setNarrationError] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderLabel, setRenderLabel] = useState('Rendering final video…');
  const [renderError, setRenderError] = useState('');
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [addTitleCard, setAddTitleCard] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [cardSubtitle, setCardSubtitle] = useState('');

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
      setNarrationError(friendlyError(e));
      setNarrationStatus('error');
    }
  }

  async function handleRecordStep(seg: ScriptSegment, blob: Blob) {
    const result = await uploadStepRecording(blob, sessionId, seg.stepNumber);
    updateSyncEntry({
      step: seg.stepNumber,
      audioFile: result.audioFile,
      audioDuration: result.audioDuration,
      videoStartTime: seg.videoStartTime,
    });
  }

  async function handlePreviewStep(seg: ScriptSegment): Promise<string> {
    const entry = syncManifest.find((e) => e.step === seg.stepNumber);
    if (!entry) throw new Error('No audio for this step yet.');
    const { previewUrl } = await previewStep(sessionId, seg.stepNumber, videoUrl, entry.audioFile, entry.videoStartTime, entry.audioDuration);
    return previewUrl;
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
      const titleCardPayload = addTitleCard && cardTitle.trim()
        ? { title: cardTitle.trim(), subtitle: cardSubtitle.trim() }
        : undefined;
      const { downloadUrl } = await renderExport(sessionId, syncManifest, videoUrl, burnSubtitles, segments, titleCardPayload, setRenderLabel);
      setDownloadUrl(downloadUrl);
      navigate('/export');
    } catch (e) {
      setRenderError(friendlyError(e));
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
            onRecordStep={handleRecordStep}
            onReorder={reorderSegments}
            onPreviewStep={handlePreviewStep}
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
                {/* Subtitle toggle */}
                <button
                  onClick={() => setBurnSubtitles((v) => !v)}
                  className="flex items-center gap-3 p-3 rounded-xl text-sm transition-all self-start"
                  style={{
                    background: burnSubtitles ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${burnSubtitles ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="w-9 h-5 rounded-full relative flex-shrink-0 transition-all"
                    style={{ background: burnSubtitles ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.12)' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: burnSubtitles ? '18px' : '2px' }} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium" style={{ color: burnSubtitles ? '#00d4ff' : 'rgba(255,255,255,0.6)' }}>
                      Burn subtitles into video
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Captions appear on screen — great for course platforms
                    </p>
                  </div>
                </button>

                {/* Title card toggle */}
                <button
                  onClick={() => {
                    const next = !addTitleCard;
                    setAddTitleCard(next);
                    if (next && !cardTitle) {
                      setCardTitle(videoContext.title);
                      setCardSubtitle(videoContext.description);
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl text-sm transition-all self-start"
                  style={{
                    background: addTitleCard ? 'rgba(180,77,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${addTitleCard ? 'rgba(180,77,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="w-9 h-5 rounded-full relative flex-shrink-0 transition-all"
                    style={{ background: addTitleCard ? 'rgba(180,77,255,0.6)' : 'rgba(255,255,255,0.12)' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: addTitleCard ? '18px' : '2px' }} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium" style={{ color: addTitleCard ? '#b44dff' : 'rgba(255,255,255,0.6)' }}>
                      Add title card at start
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      3-second branded intro — ideal for course platforms
                    </p>
                  </div>
                </button>

                {addTitleCard && (
                  <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'rgba(180,77,255,0.04)', border: '1px solid rgba(180,77,255,0.12)' }}>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(255,255,255,0.5)' }}>Title</label>
                      <input
                        value={cardTitle}
                        onChange={(e) => setCardTitle(e.target.value)}
                        placeholder="e.g. How to Use VoiceGuide"
                        maxLength={80}
                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,77,255,0.2)', caretColor: '#b44dff' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(255,255,255,0.5)' }}>Tagline <span style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                      <input
                        value={cardSubtitle}
                        onChange={(e) => setCardSubtitle(e.target.value)}
                        placeholder="e.g. A step-by-step tutorial"
                        maxLength={70}
                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,77,255,0.2)', caretColor: '#b44dff' }}
                      />
                    </div>
                  </div>
                )}

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
                      {renderLabel}
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
