import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ScriptSegment } from '../store/useStore';
import BackButton from '../components/BackButton';

function esc(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'transcript';
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

  const hasTranscript = segments.length > 0;

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
    <div className="max-w-2xl mx-auto px-6 py-16">
      <BackButton to="/review" />

      <h1 className="text-4xl font-bold text-white mb-2">Your tutorial is ready!</h1>
      <p className="text-dim mb-10">
        Download your finished MP4 and transcript — ready to upload to any course platform.
      </p>

      <div className="flex flex-col gap-6">
        {/* MP4 download */}
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Video</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
              ▶
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">Narrated screen recording</p>
              <p className="text-xs text-dim truncate">{downloadUrl.split('/').pop()}</p>
            </div>
            <a href={downloadUrl} download className="btn-neon text-sm px-4 py-2 whitespace-nowrap">
              Download MP4
            </a>
          </div>
        </div>

        {/* Transcript download */}
        {hasTranscript && (
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Transcript</span>
            </div>

            <div className="flex flex-col gap-2">
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

            <div className="flex gap-3 flex-wrap pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => downloadTxt(videoContext.title, segments)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              >
                <span>⬇</span> Save as .txt
              </button>
              <button
                onClick={() => openPdf(videoContext.title, videoContext.description, segments)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={{ background: 'rgba(180,77,255,0.08)', border: '1px solid rgba(180,77,255,0.2)', color: '#b44dff' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180,77,255,0.14)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(180,77,255,0.08)'; }}
              >
                <span>⬇</span> Export as PDF
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/setup')}
          className="self-start text-sm text-dim hover:text-neon transition-colors underline mt-2"
        >
          Create another tutorial →
        </button>
      </div>
    </div>
  );
}
