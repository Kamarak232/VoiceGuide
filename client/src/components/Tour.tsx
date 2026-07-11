import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TOUR_KEY = 'vg-tour-done';

const STEPS = [
  {
    route: '/onboarding',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" fill="#00d4ff" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M9 22h6" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    step: 1,
    title: 'Clone your voice',
    body: 'Record 2–3 minutes of yourself speaking naturally. Every tutorial you make will sound exactly like you.',
    cta: 'Next: Set context →',
    nextRoute: '/setup',
  },
  {
    route: '/setup',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#b44dff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    step: 2,
    title: 'Set your tutorial context',
    body: 'Give your tutorial a title, audience, and tone. The AI uses this to write a sharper, more relevant script.',
    cta: 'Next: Record →',
    nextRoute: '/record',
  },
  {
    route: '/record',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#00d4ff" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="4" fill="#00d4ff" />
      </svg>
    ),
    step: 3,
    title: 'Record your screen',
    body: 'Click Start Recording, share your screen, then navigate as normal. Talking aloud gives the AI more to work with.',
    cta: 'Got it — start recording 🎉',
    nextRoute: null,
  },
];

export default function Tour({ userId }: { userId: string | undefined }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const done = localStorage.getItem(TOUR_KEY) === 'true';
  const currentStep = STEPS.find((s) => s.route === location.pathname);

  useEffect(() => {
    if (!userId || done || dismissed || !currentStep) {
      setVisible(false);
      return;
    }
    // Small delay so the page renders first
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [location.pathname, userId, done, dismissed, currentStep]);

  function handleNext() {
    if (!currentStep) return;
    if (currentStep.nextRoute) {
      navigate(currentStep.nextRoute);
    } else {
      // Last step — mark done
      localStorage.setItem(TOUR_KEY, 'true');
      setVisible(false);
    }
  }

  function handleSkip() {
    localStorage.setItem(TOUR_KEY, 'true');
    setDismissed(true);
    setVisible(false);
  }

  if (!visible || !currentStep) return null;

  const totalSteps = STEPS.length;

  return (
    <>
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.25)' }}
      />

      {/* Tour card */}
      <div
        className="fixed z-50 mx-auto"
        style={{
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(420px, calc(100vw - 32px))',
          background: 'rgba(10,10,26,0.97)',
          border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: '20px',
          boxShadow: '0 0 0 1px rgba(0,212,255,0.08), 0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.08)',
          backdropFilter: 'blur(16px)',
          animation: 'tourSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <style>{`
          @keyframes tourSlideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          @keyframes tourPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
            50%       { box-shadow: 0 0 0 6px rgba(0,212,255,0); }
          }
        `}</style>

        <div className="p-5">
          {/* Step dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="rounded-full transition-all"
                style={{
                  width: s.step === currentStep.step ? '20px' : '6px',
                  height: '6px',
                  background: s.step === currentStep.step
                    ? '#00d4ff'
                    : s.step < currentStep.step
                    ? 'rgba(0,212,255,0.4)'
                    : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
            <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {currentStep.step} / {totalSteps}
            </span>
          </div>

          {/* Icon + content */}
          <div className="flex gap-4 items-start mb-5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {currentStep.icon}
            </div>
            <div>
              <p className="text-white font-semibold text-base mb-1">{currentStep.title}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {currentStep.body}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleNext}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(180,77,255,0.12))',
                border: '1px solid rgba(0,212,255,0.3)',
                color: '#fff',
                boxShadow: '0 0 16px rgba(0,212,255,0.12)',
              }}
            >
              {currentStep.cta}
            </button>
            <button
              onClick={handleSkip}
              className="text-xs transition-colors px-2"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              Skip tour
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Call this after a new user signs up to reset the tour */
export function resetTour() {
  localStorage.removeItem(TOUR_KEY);
}
