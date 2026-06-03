/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Terminal, X } from 'lucide-react';
import ArduinoCodingMission from '../components/arduino-ide/ArduinoCodingMission';
import { MissionOverlay } from '../components/MissionOverlay';
import {
  isToolActivityEmbed,
  isScreensActivityEmbed,
  parseToolActivityEmbed,
  screensActivityPlayerUrl,
  toolActivityPlayerUrl,
} from '../lib/toolActivity';
import {
  isArduinoMissionByMetadata,
  isElectricityPreFlowMission,
  isElectricityPreFlowEmbed,
  electricityActivityUrl,
} from '../app/types';
import type { Mission } from '../app/types';
function toEmbeddableUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  // YouTube: watch?v= -> /embed/
  const ytWatch = url.match(/^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+).*/i);
  if (ytWatch?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(ytWatch[1])}`;
  const ytShort = url.match(/^https?:\/\/youtu\.be\/([^?&/]+).*/i);
  if (ytShort?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(ytShort[1])}`;

  // Vimeo: vimeo.com/<id> -> player.vimeo.com/video/<id>
  const vimeo = url.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+).*/i);
  if (vimeo?.[1]) return `https://player.vimeo.com/video/${encodeURIComponent(vimeo[1])}`;

  // Scratch: scratch.mit.edu/projects/<id>/ -> embed
  const scratch = url.match(/^https?:\/\/scratch\.mit\.edu\/projects\/(\d+)\/?/i);
  if (scratch?.[1]) return `https://scratch.mit.edu/projects/${scratch[1]}/embed`;

  return url;
}

/** Normalize + sanitize game URL/embed and return a safe src URL. */
function extractEmbedSrc(embed: string | null | undefined): string | null {
  if (!embed || typeof embed !== 'string') return null;
  const s = embed.trim();
  if (!s) return null;

  // Plain URL (http/https)
  if (/^https?:\/\/[^\s<>"']+$/i.test(s)) {
    return toEmbeddableUrl(s).replace(/["'<>]/g, '');
  }

  // Iframe snippet: extract src (src may have no leading space in markup)
  const srcMatch = s.match(/<iframe[^>]*\s*src\s*=\s*["']([^"']+)["'][^>]*>/i);
  const src = (srcMatch?.[1] || '').trim();
  if (src && /^https?:\/\//i.test(src)) {
    return toEmbeddableUrl(src).replace(/["'<>]/g, '');
  }

  // Already a single safe iframe (e.g. stored from server)
  if (/<iframe\s*[^>]*\s*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/i.test(s) && !/<(script|object)/i.test(s)) {
    const one = s.match(/src\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    if (one?.[1]) {
      return toEmbeddableUrl(one[1]).replace(/["'<>]/g, '');
    }
  }

  return null;
}

/** Reject mission embeds that point at the SPA shell (/) instead of the activity file. */
function isBrokenHomepageEmbed(embed: string | null | undefined): boolean {
  const src = extractEmbedSrc(embed);
  if (!src || typeof window === 'undefined') return false;
  try {
    const u = new URL(src, window.location.origin);
    return u.origin === window.location.origin && (u.pathname === '/' || u.pathname === '');
  } catch {
    return false;
  }
}

const ScreensActivityPlayer = ({
  mission,
  onComplete,
}: {
  mission: Mission;
  onComplete: () => void;
}) => {
  const embed = String(mission.embed_code || '').trim();
  const src = isScreensActivityEmbed(embed)
    ? screensActivityPlayerUrl(embed, { missionId: mission.id, xp: mission.xp_reward })
    : `/stemverse-screens-player.html?embed=1&mission_id=${mission.id}&xp=${mission.xp_reward || 0}`;

  return (
    <MissionOverlay
      src={src}
      title={mission.title}
      name="stemverse-screens-activity"
      onComplete={onComplete}
    />
  );
};

const ToolActivityPlayer = ({
  mission,
  onComplete,
}: {
  mission: Mission;
  onComplete: () => void;
}) => {
  const config = parseToolActivityEmbed(mission.embed_code);
  const src = config
    ? toolActivityPlayerUrl(config, { missionId: mission.id })
    : `/stemverse-tool-player.html?embed=1&mission_id=${mission.id}`;

  return (
    <MissionOverlay
      src={src}
      title={mission.title}
      name="stemverse-tool-activity"
      onComplete={onComplete}
    />
  );
};

const ElectricityPreFlowPlayer = ({
  mission,
  onComplete,
}: {
  mission: Mission;
  onComplete: () => void;
}) => {
  useEffect(() => {
    try {
      localStorage.setItem('stemverse_parent', '1');
    } catch {
      /* ignore */
    }
    const onLaunch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.complete) onComplete();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'novaGameLaunch' && e.data?.detail?.complete) onComplete();
    };
    window.addEventListener('novaGameLaunch', onLaunch);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('novaGameLaunch', onLaunch);
      window.removeEventListener('message', onMessage);
      try {
        localStorage.removeItem('stemverse_parent');
      } catch {
        /* ignore */
      }
    };
  }, [onComplete]);

  const src = electricityActivityUrl();

  return (
    <iframe
      key={src}
      src={src}
      name="stemverse-electricity-activity"
      className="fixed inset-0 w-full h-full border-0 z-[125]"
      style={{ top: 0, left: 0, width: '100%', height: '100dvh', minHeight: '100dvh' }}
      title={mission.title}
      allow="autoplay"
    />
  );
};

const OhmsLawExplorerPlayer = ({
  mission,
  onComplete,
}: {
  mission: Mission;
  onComplete: () => void;
}) => {
  return (
    <MissionOverlay
      src="/ohms-law-explorer.html"
      title={mission.title}
      name="stemverse-ohms-law-explorer"
      onComplete={onComplete}
    />
  );
};

const GamePlayer = ({
  mission,
  onComplete,
  sectorName = null,
}: {
  mission: Mission;
  onComplete: () => void;
  sectorName?: string | null;
}) => {
  const isArduinoMission = isArduinoMissionByMetadata(mission);
  const isElectricityMission =
    isElectricityPreFlowMission(mission, sectorName) ||
    isElectricityPreFlowEmbed(mission.embed_code) ||
    isBrokenHomepageEmbed(mission.embed_code);
  const embedSrc = extractEmbedSrc(mission.embed_code);
  const embed = String(mission.embed_code || '').trim().toLowerCase();
  if (isArduinoMission) {
    return (
      <ArduinoCodingMission
        missionId={mission.id}
        missionTitle={mission.title}
        onComplete={onComplete}
      />
    );
  }
  if (isElectricityMission) {
    return <ElectricityPreFlowPlayer mission={mission} onComplete={onComplete} />;
  }
  if (embed.startsWith('stemverse://ohms-law-explorer')) {
    return <OhmsLawExplorerPlayer mission={mission} onComplete={onComplete} />;
  }
  if (isScreensActivityEmbed(mission.embed_code)) {
    return <ScreensActivityPlayer mission={mission} onComplete={onComplete} />;
  }
  if (isToolActivityEmbed(mission.embed_code)) {
    return <ToolActivityPlayer mission={mission} onComplete={onComplete} />;
  }
  return (
    <div className="space-y-8">
      <div className="bg-black rounded-2xl border border-brand-blue/30 overflow-hidden aspect-video relative shadow-2xl shadow-brand-blue/10 min-h-[400px]">
        {embedSrc ? (
          <iframe
            src={embedSrc}
            className="size-full min-h-[400px]"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
            title={mission.title}
          />
        ) : (
          <div className="size-full flex flex-col items-center justify-center p-12 text-center relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #003c71 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="size-24 bg-brand-blue/10 rounded-2xl flex items-center justify-center mb-8 border border-brand-blue/20 shadow-[0_0_30px_rgba(0,60,113,0.1)]">
              <Terminal className="text-brand-blue size-12" />
            </div>
            <h3 className="text-4xl font-black text-white uppercase italic mb-4 tracking-tighter">{mission.title}</h3>
            <p className="text-brand-blue/60 max-w-md font-mono text-xs mb-10 uppercase tracking-widest">{mission.description}</p>
            
            <div className="p-10 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-600/40 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black text-brand-blue/50 tracking-[0.2em] mb-1">Skill Practice</p>
                  <p className="text-xs font-black text-white uppercase">Simulation Ready</p>
                </div>
                <div className="size-2 bg-brand-blue rounded-full animate-pulse shadow-[0_0_8px_rgba(0,60,113,0.5)]" />
              </div>
              <button 
                onClick={onComplete}
                className="w-full bg-brand-blue text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-xs hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 active:scale-95"
              >
                Complete Activity
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Difficulty</span>
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
              mission.difficulty === 'Hard' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'
            }`}>
              {mission.difficulty}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">XP Reward</span>
            <span className="text-brand-blue font-black font-mono text-lg">+{mission.xp_reward} XP</span>
          </div>
        </div>
        <button 
          onClick={onComplete}
          className="group flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors"
        >
          <X className="size-4 group-hover:rotate-90 transition-transform" />
          Terminate Session
        </button>
      </div>
    </div>
  );
};

const MissionSimulation = ({ mission, onComplete, onCancel }: { mission: Mission, onComplete: (mission: Mission) => void, onCancel: () => void }) => {
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const steps = [
    { title: "Learning Session Started", log: "> PREPARING ACTIVITIES... READY" },
    { title: "Analyzing Data Streams", log: "> PROCESSING STEM VARIABLES... [QUANTUM_FLUX: 0.82]" },
    { title: "Executing Protocol", log: "> APPLYING THEORETICAL MODELS... SUCCESS" },
    { title: "Mission Finalizing", log: "> CALCULATING NEURAL GROWTH... COMPLETE" }
  ];

  useEffect(() => {
    if (step < steps.length) {
      const timer = setTimeout(() => {
        setLogs(prev => [...prev, steps[step].log]);
        setStep(s => s + 1);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setTimeout(() => {
        onComplete(mission);
      }, 1000);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-2xl" />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-2xl bg-black rounded-2xl border border-brand-blue/30 overflow-hidden shadow-[0_0_50px_rgba(0,60,113,0.2)]"
      >
        {/* Terminal Header */}
        <div className="bg-slate-900 px-8 py-4 border-b border-brand-blue/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-red-500/20 border border-red-500/50" />
            <div className="size-3 rounded-full bg-brand-yellow/20 border border-brand-yellow/50" />
            <div className="size-3 rounded-full bg-brand-blue/20 border border-brand-blue/50" />
          </div>
          <span className="text-[10px] font-black text-brand-blue/50 uppercase tracking-[0.4em]">Mission Execution Terminal</span>
          <div className="size-4" />
        </div>

        <div className="p-12 space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">{mission.title}</h2>
            <div className="flex items-center justify-center gap-4">
              <div className="h-1 w-32 bg-brand-blue/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / steps.length) * 100}%` }}
                  className="h-full bg-brand-blue shadow-[0_0_10px_rgba(0,60,113,0.5)]"
                />
              </div>
              <span className="text-xs font-mono text-brand-blue">{Math.round((step / steps.length) * 100)}%</span>
            </div>
          </div>

          <div className="bg-slate-950 rounded-3xl p-8 border border-brand-blue/10 font-mono text-xs space-y-2 min-h-[200px]">
            {logs.map((log, i) => (
              <motion.p 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-brand-blue/80"
              >
                {log}
              </motion.p>
            ))}
            {step < steps.length && (
              <motion.p 
                animate={{ opacity: [0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="text-brand-blue"
              >
                _
              </motion.p>
            )}
          </div>

          <div className="flex justify-center">
            <button 
              onClick={onCancel}
              className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              Abort Protocol
            </button>
          </div>
        </div>

        {/* HUD Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-1/2 left-0 w-full h-px bg-brand-blue/5" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-brand-blue/5" />
        </div>
      </motion.div>
    </div>
  );
};

export {
  toEmbeddableUrl,
  extractEmbedSrc,
  isBrokenHomepageEmbed,
  ToolActivityPlayer,
  ElectricityPreFlowPlayer,
  GamePlayer,
  MissionSimulation,
};
export { MissionOverlay } from '../components/MissionOverlay';
