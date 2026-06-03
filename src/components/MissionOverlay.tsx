/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

const COMPLETE_MESSAGE_TYPES = new Set(['MISSION_COMPLETE', 'STEMVERSE_COMPLETE']);

export type MissionOverlayProps = {
  src: string;
  title: string;
  name?: string;
  onComplete: () => void;
  /** Parent-hosted Finish appears after this delay if embed does not complete (default 60s). */
  fallbackMs?: number;
};

/**
 * Full-viewport mission iframe with postMessage completion and a parent Finish
 * control above the iframe (z-[140]) so clicks are never swallowed by the embed.
 */
export function MissionOverlay({
  src,
  title,
  name = 'stemverse-mission-embed',
  onComplete,
  fallbackMs = 60_000,
}: MissionOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completingRef = useRef(false);
  const [finished, setFinished] = useState(false);
  const [showFallbackFinish, setShowFallbackFinish] = useState(false);

  const completeMission = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    setFinished(true);
    onComplete();
  }, [onComplete]);

  const handleFallbackFinish = useCallback(() => {
    console.log('[MissionOverlay] Finish button clicked', { title, src });
    completeMission();
  }, [completeMission, title, src]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const type = e.data?.type;
      if (!type || !COMPLETE_MESSAGE_TYPES.has(type)) return;

      const fromOurFrame = iframeRef.current?.contentWindow === e.source;
      const sameOrigin = e.origin === window.location.origin;

      if (!fromOurFrame && !sameOrigin) return;

      console.log('[MissionOverlay] postMessage received', { type, origin: e.origin, fromOurFrame });
      completeMission();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [completeMission]);

  useEffect(() => {
    const id = window.setTimeout(() => setShowFallbackFinish(true), fallbackMs);
    return () => clearTimeout(id);
  }, [fallbackMs]);

  return (
    <>
      <iframe
        ref={iframeRef}
        key={src}
        src={src}
        name={name}
        className="fixed inset-0 w-full h-full border-0 z-[125] pointer-events-auto"
        style={{ top: 0, left: 0, width: '100%', height: '100dvh', minHeight: '100dvh' }}
        title={title}
        allow="autoplay"
      />
      {showFallbackFinish && !finished && (
        <button
          type="button"
          onClick={handleFallbackFinish}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[140] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm bg-amber-500 text-[#0A192F] shadow-[0_0_24px_rgba(245,158,11,0.45)] hover:scale-105 active:scale-95 transition-transform pointer-events-auto"
          aria-label="Finish mission"
        >
          Finish mission
        </button>
      )}
    </>
  );
}
