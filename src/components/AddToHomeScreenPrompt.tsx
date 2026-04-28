import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const SESSION_KEY = 'stemverse_pwa_session_seen';
const SESSION_COUNT_KEY = 'stemverse_pwa_session_count';
const DISMISS_KEY = 'stemverse_pwa_prompt_dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isMobileDevice = () =>
  window.matchMedia('(max-width: 768px)').matches &&
  window.matchMedia('(pointer: coarse)').matches;

export default function AddToHomeScreenPrompt() {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isIosSafari = useMemo(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    return isIos && isSafari;
  }, []);

  useEffect(() => {
    if (!isMobileDevice() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    if (sessionStorage.getItem(SESSION_KEY) !== '1') {
      const existing = Number(localStorage.getItem(SESSION_COUNT_KEY) || '0');
      localStorage.setItem(SESSION_COUNT_KEY, String(existing + 1));
      sessionStorage.setItem(SESSION_KEY, '1');
    }

    const count = Number(localStorage.getItem(SESSION_COUNT_KEY) || '0');
    if (count >= 2) {
      setEligible(true);
      if (isIosSafari) {
        setOpen(true);
      }
    }
  }, [isIosSafari]);

  useEffect(() => {
    if (!eligible) return;
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, [eligible]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  const install = async () => {
    if (!deferredPrompt) {
      setOpen(true);
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setOpen(false);
      setDeferredPrompt(null);
    }
  };

  if (!open || !eligible || isStandalone()) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[220] mx-auto w-auto max-w-md rounded-2xl border border-[rgba(118,132,159,0.35)] bg-[rgba(10,16,32,0.95)] p-4 text-[var(--ca-on-surface)] shadow-2xl backdrop-blur-xl">
      <p className="text-sm font-semibold">Install STEMverse on your home screen</p>
      {isIosSafari ? (
        <p className="mt-2 text-xs text-[var(--ca-on-surface-variant)]">
          Tap Share, then choose Add to Home Screen.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--ca-on-surface-variant)]">
          Install for a faster full-screen experience and offline access.
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        {!isIosSafari && (
          <button
            type="button"
            onClick={install}
            className="min-h-11 rounded-lg bg-[#3C3489] px-4 text-sm font-semibold text-white hover:brightness-110"
          >
            Add to Home Screen
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 rounded-lg border border-[rgba(148,163,184,0.35)] px-4 text-sm font-semibold text-slate-200 hover:bg-[rgba(148,163,184,0.14)]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
