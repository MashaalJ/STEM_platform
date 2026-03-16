import React, { useState } from 'react';
import { Image, Video, Mic } from 'lucide-react';
import type { ShortAnswerContent, ChallengeContent, MediaType } from '../types';

export const defaultContent = (): ShortAnswerContent => ({
  question: '',
  accept: [''],
  caseSensitive: false,
});

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean } {
  const c = content as ShortAnswerContent;
  const ans = String(response ?? '').trim();
  const accept = (c.accept || []).map((a) => (c.caseSensitive ? a : a.toLowerCase()));
  const normalized = c.caseSensitive ? ans : ans.toLowerCase();
  const correct = accept.some((a) => a && normalized === a);
  return { score: correct ? 1 : 0, correct };
}

export function ShortAnswerEditor({ content, onChange }: { content: ChallengeContent; onChange: (c: ChallengeContent) => void }) {
  const c = content as ShortAnswerContent;
  const update = (patch: Partial<ShortAnswerContent>) => onChange({ ...c, ...patch });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Question</label>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 uppercase">Media URL</span>
          {(['image', 'video', 'audio'] as MediaType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => update({ mediaType: type, mediaUrl: c.mediaType === type ? c.mediaUrl : '' })}
              className={`p-1.5 rounded ${c.mediaType === type ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}
              title={type}
            >
              {type === 'image' && <Image className="w-4 h-4" />}
              {type === 'video' && <Video className="w-4 h-4" />}
              {type === 'audio' && <Mic className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>
      {c.mediaType && (
        <input
          type="url"
          value={c.mediaUrl ?? ''}
          onChange={(e) => update({ mediaUrl: e.target.value.trim() || undefined })}
          placeholder="Paste image, video, or audio URL..."
          className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2 text-sm text-slate-100"
        />
      )}
      {c.mediaUrl && c.mediaType === 'image' && (
        <img src={c.mediaUrl} alt="" className="max-h-48 rounded-xl object-contain border border-slate-600" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <textarea
        value={c.question}
        onChange={(e) => update({ question: e.target.value })}
        placeholder="Enter the question..."
        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 min-h-[80px]"
        rows={2}
      />
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Acceptable answers (one per line)</label>
      <textarea
        value={c.accept?.join('\n') ?? ''}
        onChange={(e) => update({ accept: e.target.value.split(/\n/).map((s) => s.trim()).filter(Boolean) })}
        placeholder="answer1"
        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 font-mono text-sm"
        rows={3}
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={c.caseSensitive ?? false} onChange={(e) => update({ caseSensitive: e.target.checked })} className="rounded border-slate-500" />
        <span className="text-sm text-slate-300">Case sensitive</span>
      </label>
    </div>
  );
}

export function ShortAnswerPlayer({ content, onComplete, disabled }: { content: ChallengeContent; onComplete: (response: unknown) => void; disabled?: boolean }) {
  const c = content as ShortAnswerContent;
  const [value, setValue] = useState('');
  return (
    <div className="space-y-4">
      {c.mediaUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-600 bg-slate-800/50">
          {c.mediaType === 'image' && <img src={c.mediaUrl} alt="" className="w-full max-h-48 object-contain" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
          {c.mediaType === 'video' && <video src={c.mediaUrl} controls className="w-full max-h-48" />}
          {c.mediaType === 'audio' && <div className="p-3"><audio src={c.mediaUrl} controls className="w-full" /></div>}
        </div>
      )}
      <p className="text-slate-200 font-medium">{c.question}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Your answer..."
        className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100"
        disabled={disabled}
      />
      <button type="button" onClick={() => onComplete(value)} disabled={disabled || !value.trim()} className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-black text-sm uppercase disabled:opacity-50">
        Check
      </button>
    </div>
  );
}
