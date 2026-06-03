/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

function extractYouTubeId(url: string): string | null {
  const u = url.trim();
  const watch = u.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/)([^&?/]+)/i);
  if (watch?.[1]) return watch[1];
  const short = u.match(/youtu\.be\/([^?&/]+)/i);
  if (short?.[1]) return short[1];
  return null;
}

function extractVimeoId(url: string): string | null {
  const m = url.trim().match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m?.[1] ?? null;
}

export default function VideoPlayer({
  url,
  title,
  duration: _duration,
  onComplete,
  onClose,
}: {
  url: string;
  title: string;
  duration?: number;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [canMarkWatched, setCanMarkWatched] = useState(false);

  useEffect(() => {
    setCanMarkWatched(false);
    const t = window.setTimeout(() => setCanMarkWatched(true), 15_000);
    return () => window.clearTimeout(t);
  }, [url]);

  const ytId = extractYouTubeId(url);
  const vimeoId = extractVimeoId(url);
  const isYouTube = Boolean(ytId) || /youtube\.com|youtu\.be/i.test(url);
  const isVimeo = Boolean(vimeoId) || /vimeo\.com/i.test(url);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex w-full max-w-4xl flex-col rounded-2xl bg-[#0a1628] text-white shadow-2xl border border-slate-700"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-slate-800/90 p-2 text-slate-200 hover:bg-slate-700"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="px-6 pt-6 pb-2 pr-14">
          <h2 className="text-xl font-black text-white">{title}</h2>
        </div>

        <div className="aspect-video w-full bg-black">
          {isYouTube && ytId ? (
            <iframe
              title={title}
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${encodeURIComponent(ytId)}?enablejsapi=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : isVimeo && vimeoId ? (
            <iframe
              title={title}
              className="h-full w-full"
              src={`https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video className="h-full w-full" src={url} controls playsInline>
              <track kind="captions" />
            </video>
          )}
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-slate-400">Watch the video to continue</p>
          {/* TODO: use YouTube API for actual watch percentage tracking */}
          <button
            type="button"
            disabled={!canMarkWatched}
            onClick={onComplete}
            className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-teal-400"
          >
            Mark as Watched
          </button>
        </div>
      </motion.div>
    </div>
  );
}
