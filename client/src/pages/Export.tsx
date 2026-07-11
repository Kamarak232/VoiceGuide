import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ScriptSegment } from '../store/useStore';
import { useState } from 'react';

function esc(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tutorial';
}

function buildPrintHtml(title: string, description: string, segments: ScriptSegment[]): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const steps = segments
    .map(
      (s) => `<div class="step">
        <p class="label">Step ${s.stepNumber}</p>
        <p class="body">${esc(s.text)}</p>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(title || 'Tutorial')} — Transcript</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 13pt; color: #111; line-height: 1.75; }
  .page { max-width: 680px; margin: 48px auto; padding: 0 32px; }
  header { border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 36px; }
  h1 { font-size: 24pt; font-weight: bold; margin-bottom: 8px; }
  .desc { font-size: 12pt; color: #444; margin-bottom: 6px; }
  .meta { font-size: 9pt; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
  .step { margin-bottom: 28px; }
  .label { font-size: 9pt; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700;
           text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 4px; }
  .body { font-size: 13pt; }
  .noprint { font-family: Arial, sans-serif; font-size: 11pt; background: #f0f4ff; border: 1px solid #c7d2fe;
             border-radius: 6px; padding: 10px 16px; margin-bottom: 28px; color: #312e81; }
  @media print { .noprint { display: none; } .page { margin: 0; } }
</style>
</head>
<body>
<div class="page">
  <p class="noprint">Your browser's print dialog will open. Choose <strong>Save as PDF</strong> as the destination.</p>
  <header>
    <h1>${esc(title || 'Tutorial Transcript')}</h1>
    ${description ? `<p class="desc">${esc(description)}</p>` : ''}
    <p class="meta">Transcript · ${date}</p>
  </header>
  ${steps}
</div>
</body>
</html>`;
}

function downloadTxt(title: string, segments: ScriptSegment[]) {
  const heading = title || 'Tutorial Transcript';
  const divider = '─'.repeat(Math.min(heading.length, 60));
  const body = segments.map((s) => `Step ${s.stepNumber}\n${s.text}`).join('\n\n');
  const content = `${heading}\n${divider}\n\n${body}\n`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(heading)}-transcript.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openPdf(title: string, description: string, segments: ScriptSegment[]) {
  const html = buildPrintHtml(title, description, segments);
  const win = window.open('', '_blank', 'width=840,height=960');
  if (!win) { alert('Allow pop-ups to export as PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function Export() {
  const navigate = useNavigate();
  const downloadUrl = useStore((s) => s.downloadUrl);
  const segments = useStore((s) => s.segments);
  const videoContext = useStore((s) => s.videoContext);
  const sessionId = useStore((s) => s.sessionId);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = sessionId ? `${window.location.origin}/watch/${sessionId}` : null;

  function handleCopyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasTranscript = segments.length > 0;
  const filename = `${slugify(videoContext.title || 'tutorial')}.mp4`;

  // Fetch and force to Chrome downloads — the <a download> attribute
  // does not work for cross-origin URLs; it just opens in the browser.
  async function handleDownload() {
    if (!downloadUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (!downloadUrl) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-dim">
        No export ready yet.{' '}
        <button className="underline text-neon" onClick={() => navigate('/review')}>
          Go to review →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm mb-8 transition-colors"
        style={{ color: 'rgba(255,255,255,0.35)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      <h1 className="text-3xl font-bold text-white mb-1">Your tutorial is ready</h1>
      <p className="text-dim text-sm mb-8">Preview your video, then download it to share or upload to any course platform.</p>

      {/* Video player — fills the width */}
      <div className="rounded-2xl overflow-hidden mb-8" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
        <video
          src={downloadUrl}
          controls
          style={{ width: '100%', display: 'block', maxHeight: '60vh' }}
        />
      </div>

      {/* Download button */}
      <div className="flex items-center gap-4 mb-10 flex-wrap">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn-neon flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(180,77,255,0.1))',
            borderColor: 'rgba(0,212,255,0.5)',
            boxShadow: '0 0 20px rgba(0,212,255,0.15)',
          }}
        >
          {downloading ? (
            <>
              <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
              Preparing download…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download MP4
            </>
          )}
        </button>

        {shareUrl && (
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
            style={{
              background: copied ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copied ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
              color: copied ? '#00d4ff' : 'rgba(255,255,255,0.7)',
            }}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-7" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Link copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M9 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9M11 1h4m0 0v4m0-4L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Share link
              </>
            )}
          </button>
        )}

        <button
          onClick={() => navigate('/record')}
          className="text-sm transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#00d4ff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          Create another tutorial →
        </button>
      </div>

      {/* Transcript */}
      {hasTranscript && (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Transcript</p>
          <div className="flex flex-col gap-3 mb-5">
            {segments.map((s) => (
              <div key={s.stepNumber} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}>
                  {s.stepNumber}
                </span>
                <p className="text-sm text-dim leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => downloadTxt(videoContext.title, segments)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save as .txt
            </button>
            <button
              onClick={() => openPdf(videoContext.title, videoContext.description, segments)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
              style={{ background: 'rgba(180,77,255,0.08)', border: '1px solid rgba(180,77,255,0.2)', color: '#b44dff' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180,77,255,0.14)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(180,77,255,0.08)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
