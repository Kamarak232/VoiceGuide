import { VideoContext } from '../store/useStore';

interface Props {
  value: VideoContext;
  onChange: (ctx: VideoContext) => void;
  onSubmit: () => void;
}

const TONE_OPTIONS: { value: VideoContext['tone']; label: string; desc: string; emoji: string }[] = [
  { value: 'enthusiastic', label: 'Enthusiastic', desc: 'High energy, hype-building', emoji: '🔥' },
  { value: 'explanatory', label: 'Explanatory', desc: 'Clear, methodical, educational', emoji: '🎓' },
  { value: 'friendly', label: 'Friendly', desc: 'Casual, warm & conversational', emoji: '😊' },
  { value: 'professional', label: 'Professional', desc: 'Polished & authoritative', emoji: '💼' },
  { value: 'concise', label: 'Concise', desc: 'Straight to the point, no fluff', emoji: '⚡' },
  { value: 'beginner', label: 'Beginner-friendly', desc: 'Slow, reassuring, no jargon', emoji: '🌱' },
];

export default function VideoContextForm({ value, onChange, onSubmit }: Props) {
  const isReady = value.title.trim() && value.description.trim();

  function set(field: keyof VideoContext, val: string) {
    onChange({ ...value, [field]: val });
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (isReady) onSubmit(); }}
      className="flex flex-col gap-6 max-w-xl"
    >
      <div className="flex flex-col gap-1.5">
        <label className="label-dark">Tutorial title *</label>
        <p className="hint-dark">Helps the AI write an intro that hooks the viewer.</p>
        <input
          type="text"
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder='e.g. "How to set up a Stripe payment link"'
          className="input-dark mt-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-dark">What this tutorial covers *</label>
        <p className="hint-dark">Helps the AI infer steps if your live narration was incomplete.</p>
        <textarea
          rows={3}
          maxLength={500}
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="e.g. A step-by-step walkthrough of creating a one-time payment link in Stripe…"
          className="input-dark mt-1 resize-none"
        />
        <span className="hint-dark text-right">{value.description.length}/500</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-dark">Who is the audience?</label>
        <p className="hint-dark">Helps the AI match jargon and terminology to your viewers.</p>
        <input
          type="text"
          value={value.audience}
          onChange={(e) => set('audience', e.target.value)}
          placeholder='e.g. "Small business owners with no coding experience"'
          className="input-dark mt-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-dark">Tone</label>
        <p className="hint-dark">Controls how the voiceover script sounds.</p>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {TONE_OPTIONS.map((o) => {
            const active = value.tone === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => set('tone', o.value)}
                className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(180,77,255,0.07))' : 'rgba(255,255,255,0.02)',
                  border: active ? '1px solid rgba(0,212,255,0.35)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: active ? '0 0 12px rgba(0,212,255,0.12)' : 'none',
                }}
              >
                <span className="text-lg leading-none mt-0.5">{o.emoji}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium" style={{ color: active ? '#00d4ff' : 'rgba(255,255,255,0.85)' }}>
                    {o.label}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(119,119,170,0.8)' }}>{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-dark">Keywords or terms to include</label>
        <p className="hint-dark">Comma-separated. Boosts narration accuracy.</p>
        <input
          type="text"
          value={value.keywords}
          onChange={(e) => set('keywords', e.target.value)}
          placeholder='e.g. "payment link, Stripe dashboard, checkout"'
          className="input-dark mt-1"
        />
      </div>

      <button
        type="submit"
        disabled={!isReady}
        className="btn-neon self-start"
      >
        Start Recording →
      </button>
    </form>
  );
}
