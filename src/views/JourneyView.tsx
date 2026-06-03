/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CirclePlay, Lock, Target, CheckCircle2, Wrench, Zap, Star } from 'lucide-react';
import { authFetch, safeFetch } from '../app/api';
import type { Student, Sector } from '../app/types';
import { motion, AnimatePresence } from 'motion/react';
import VideoPlayer from '../components/players/VideoPlayer';
import ReadingPlayer from '../components/players/ReadingPlayer';
import { MissionOverlay } from '../components/MissionOverlay';
import ArduinoCodingMission from '../components/arduino-ide/ArduinoCodingMission';
import { isArduinoBlocklyEmbed } from '../app/types';
import { resolveActivityEmbedPlayerUrl } from '../lib/activityEmbedPlay';

type JourneyNode = {
  id: string;
  node_type: 'mission' | 'challenge' | 'video' | 'reading' | 'practice';
  title?: string | null;
  content_id?: string | null;
  content_url?: string | null;
  prerequisite_node_id?: string | null;
  xp_reward: number;
  is_completed?: boolean;
  is_bonus?: boolean;
};

type Journey = {
  id: string;
  title: string;
  description?: string | null;
  sector_id?: string | null;
  order_index?: number | null;
  nodes: JourneyNode[];
  completed_count: number;
  total_count: number;
};

type PlayDescriptor = {
  kind: string;
  title?: string;
  url?: string;
  duration?: number | null;
  transcript?: string;
  body?: string;
  estimated_minutes?: number;
  challenge_id?: string;
  quiz_id?: string;
  embed_code?: string;
  tool_type?: string;
  mission_id?: string;
  hardware_config?: Record<string, unknown>;
  message?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const nodeTheme: Record<JourneyNode['node_type'], { icon: React.ReactNode; ring: string; fill: string }> = {
  mission: { icon: <Target className="size-5" />, ring: 'ring-teal-400', fill: 'bg-teal-500' },
  challenge: { icon: <Zap className="size-5" />, ring: 'ring-amber-400', fill: 'bg-amber-500' },
  video: { icon: <CirclePlay className="size-5" />, ring: 'ring-purple-400', fill: 'bg-purple-500' },
  reading: { icon: <BookOpen className="size-5" />, ring: 'ring-blue-400', fill: 'bg-blue-500' },
  practice: { icon: <Wrench className="size-5" />, ring: 'ring-emerald-400', fill: 'bg-emerald-500' },
};

function isNodeUnlocked(node: JourneyNode, completed: Set<string>): boolean {
  return !node.prerequisite_node_id || completed.has(String(node.prerequisite_node_id));
}

function stashPendingJourneyNode(node: JourneyNode) {
  try {
    sessionStorage.setItem(
      'stemverse_pending_journey_node',
      JSON.stringify({ nodeId: node.id, xp: node.xp_reward }),
    );
  } catch {
    /* ignore */
  }
}

export default function JourneyView({
  student,
  sector,
  onOpenMission,
  onOpenChallenge,
  onOpenQuiz,
}: {
  student: Student;
  sector?: Sector | null;
  onOpenMission: (missionId: string) => void;
  onOpenChallenge: (challengeId: string) => void;
  onOpenQuiz?: (quizId: string) => void;
}) {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [celebrateXp, setCelebrateXp] = useState<number | null>(null);
  const [videoNode, setVideoNode] = useState<{ play: PlayDescriptor; node: JourneyNode } | null>(null);
  const [readingNode, setReadingNode] = useState<{ play: PlayDescriptor; node: JourneyNode } | null>(null);
  const [hardwareNode, setHardwareNode] = useState<{ play: PlayDescriptor; node: JourneyNode } | null>(null);
  const [embedPlay, setEmbedPlay] = useState<{
    node: JourneyNode;
    title: string;
    src?: string;
    arduino?: boolean;
  } | null>(null);

  const load = async () => {
    const data = await safeFetch(`/api/students/${student.id}/journeys`);
    let rows = Array.isArray(data?.journeys) ? (data.journeys as Journey[]) : [];
    if (sector?.id) {
      rows = rows.filter((j) => !j.sector_id || String(j.sector_id) === String(sector.id));
    }
    setJourneys(rows);
    if (rows.length > 0) {
      setActiveJourneyId((prev) => (prev && rows.some((j) => j.id === prev) ? prev : rows[0].id));
    } else {
      setActiveJourneyId(null);
    }
    return rows;
  };

  useEffect(() => {
    void load();
  }, [student.id, sector?.id]);

  const sortedJourneys = useMemo(
    () => [...journeys].sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0)),
    [journeys],
  );

  const journeyUnlocked = useMemo(() => {
    const map = new Map<string, boolean>();
    sortedJourneys.forEach((j, i) => {
      if (i === 0) {
        map.set(j.id, true);
        return;
      }
      const prev = sortedJourneys[i - 1];
      const pct = prev.total_count > 0 ? prev.completed_count / prev.total_count : 0;
      map.set(j.id, pct >= 0.8);
    });
    return map;
  }, [sortedJourneys]);

  const active = useMemo(
    () => sortedJourneys.find((j) => j.id === activeJourneyId) ?? null,
    [sortedJourneys, activeJourneyId],
  );

  const completedSet = useMemo(
    () => new Set((active?.nodes || []).filter((n) => n.is_completed).map((n) => String(n.id))),
    [active?.nodes],
  );

  const activeNodeId = useMemo(() => {
    const nodes = active?.nodes || [];
    const next = nodes.find((n) => !n.is_completed && isNodeUnlocked(n, completedSet));
    return next ? String(next.id) : null;
  }, [active?.nodes, completedSet]);

  const completeNode = async (nodeId: string, xp: number) => {
    const res = await authFetch(`/api/journey-nodes/${nodeId}/complete`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(body.error || 'Could not mark node complete');
      setTimeout(() => setNotice(null), 2200);
      return false;
    }
    setCelebrateXp(xp);
    setTimeout(() => setCelebrateXp(null), 1600);
    await load();
    return true;
  };

  const openUrlNode = async (node: JourneyNode) => {
    if (!node.content_url) return;
    window.open(node.content_url, '_blank', 'noopener,noreferrer');
    await completeNode(node.id, node.xp_reward);
  };

  const openHardwareNode = (play: PlayDescriptor, node: JourneyNode) => {
    setHardwareNode({ play, node });
  };

  const resolvePlayDescriptor = async (play: PlayDescriptor, node: JourneyNode) => {
    switch (play.kind) {
      case 'video':
        if (play.url) {
          setVideoNode({ play, node });
        } else {
          setNotice('This video activity has no URL yet.');
          setTimeout(() => setNotice(null), 2200);
        }
        break;
      case 'reading':
        setReadingNode({ play, node });
        break;
      case 'challenge': {
        const challengeId = String(play.challenge_id || '').trim();
        if (!challengeId) {
          setNotice('Challenge not linked to this activity.');
          setTimeout(() => setNotice(null), 2200);
          return;
        }
        stashPendingJourneyNode(node);
        onOpenChallenge(challengeId);
        break;
      }
      case 'quiz': {
        const quizId = String(play.quiz_id || '').trim();
        if (!quizId || !onOpenQuiz) {
          setNotice('Quiz not linked to this activity.');
          setTimeout(() => setNotice(null), 2200);
          return;
        }
        stashPendingJourneyNode(node);
        onOpenQuiz(quizId);
        break;
      }
      case 'embed': {
        const missionId = String(play.mission_id || '').trim();
        if (missionId && isUuid(missionId)) {
          stashPendingJourneyNode(node);
          onOpenMission(missionId);
          break;
        }
        const embedRef = String(play.embed_code || '').trim();
        if (embedRef && isUuid(embedRef)) {
          stashPendingJourneyNode(node);
          onOpenMission(embedRef);
          break;
        }
        if (embedRef) {
          const playerSrc = resolveActivityEmbedPlayerUrl(embedRef);
          if (playerSrc) {
            stashPendingJourneyNode(node);
            setEmbedPlay({
              node,
              title: String(play.title || node.title || 'Activity'),
              src: playerSrc,
            });
            break;
          }
          if (isArduinoBlocklyEmbed(embedRef)) {
            stashPendingJourneyNode(node);
            setEmbedPlay({
              node,
              title: String(play.title || node.title || 'Activity'),
              arduino: true,
            });
            break;
          }
        }
        setNotice('This activity is not linked to a playable mission yet.');
        setTimeout(() => setNotice(null), 2200);
        break;
      }
      case 'unavailable': {
        const msg =
          String(play.message || '').trim() ||
          'This activity is not available yet. Contact your teacher.';
        setNotice(msg);
        setTimeout(() => setNotice(null), 3200);
        break;
      }
      case 'hardware':
        openHardwareNode(play, node);
        break;
      default:
        console.warn('Unknown play kind:', play.kind);
    }
  };

  const legacyHandleNode = async (node: JourneyNode) => {
    if (node.node_type === 'mission' && node.content_id) {
      stashPendingJourneyNode(node);
      onOpenMission(String(node.content_id));
      return;
    }
    if (node.node_type === 'challenge' && node.content_id) {
      stashPendingJourneyNode(node);
      onOpenChallenge(String(node.content_id));
      return;
    }
    if (node.node_type === 'practice' && node.content_id && onOpenQuiz) {
      stashPendingJourneyNode(node);
      onOpenQuiz(String(node.content_id));
      return;
    }
    if ((node.node_type === 'video' || node.node_type === 'reading') && node.content_url) {
      await openUrlNode(node);
      return;
    }
    console.warn('Node has no resolvable content:', node);
  };

  const handleNodeTap = async (node: JourneyNode) => {
    if (node.is_completed) return;

    if (node.content_id) {
      try {
        const res = await authFetch(`/api/activities/${node.content_id}/play`);
        if (!res.ok) throw new Error('Activity not found');
        const play = (await res.json()) as PlayDescriptor;
        await resolvePlayDescriptor(play, node);
        return;
      } catch (e) {
        console.error('Activity resolve failed:', e);
      }
    }

    if (node.content_url) {
      await openUrlNode(node);
      return;
    }

    await legacyHandleNode(node);
  };

  const handleNodeClick = async (node: JourneyNode, unlocked: boolean) => {
    if (!unlocked) {
      const prev = active?.nodes.find((n) => String(n.id) === String(node.prerequisite_node_id));
      setNotice(prev?.title ? `Complete “${prev.title}” first.` : 'Complete the previous step first.');
      setTimeout(() => setNotice(null), 2200);
      return;
    }
    await handleNodeTap(node);
  };

  const pct = active?.total_count ? Math.round((active.completed_count / active.total_count) * 100) : 0;

  return (
    <div className="min-h-[70vh] rounded-2xl overflow-hidden border border-slate-700/50 bg-gradient-to-b from-[#0d1c32] via-[#0a1628] to-[#061018] text-slate-100">
      <div className="px-6 py-5 border-b border-slate-700/60 bg-[#0a1628]/80 backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">Learning path</p>
        <h2 className="text-2xl font-black text-white mt-1">{sector?.name || active?.title || 'Your journey'}</h2>
        <p className="text-sm text-slate-400 mt-1">{active?.description || 'Complete each node to unlock the next.'}</p>
        {sortedJourneys.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {sortedJourneys.map((j) => {
              const unlocked = journeyUnlocked.get(j.id) ?? true;
              const prev = sortedJourneys[sortedJourneys.indexOf(j) - 1];
              return (
              <button
                key={j.id}
                type="button"
                disabled={!unlocked}
                title={unlocked ? undefined : `Finish ~80% of “${prev?.title || 'the previous journey'}” first`}
                onClick={() => {
                  if (!unlocked) {
                    setNotice(`Complete about 80% of “${prev?.title || 'the previous journey'}” to unlock this path.`);
                    setTimeout(() => setNotice(null), 2800);
                    return;
                  }
                  setActiveJourneyId(j.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  j.id === activeJourneyId
                    ? 'border-teal-400 bg-teal-500/20 text-teal-200'
                    : unlocked
                      ? 'border-slate-600 text-slate-400 hover:border-slate-500'
                      : 'border-slate-700 text-slate-600 opacity-60 cursor-not-allowed'
                }`}
              >
                {!unlocked ? '🔒 ' : ''}{j.title}
              </button>
            );})}
          </div>
        )}
        {active && (
          <div className="mt-4 max-w-md">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{active.completed_count}/{active.total_count} complete</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {celebrateXp != null && celebrateXp > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full bg-teal-500 text-white font-black text-sm shadow-lg"
          >
            +{celebrateXp} XP
          </motion.p>
        )}
      </AnimatePresence>

      {notice && (
        <p className="mx-6 mt-4 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">{notice}</p>
      )}

      {videoNode && videoNode.play.url && (
        <VideoPlayer
          url={videoNode.play.url}
          title={videoNode.play.title || videoNode.node.title || 'Video'}
          duration={videoNode.play.duration ?? undefined}
          onComplete={async () => {
            await completeNode(videoNode.node.id, videoNode.node.xp_reward);
            setVideoNode(null);
          }}
          onClose={() => setVideoNode(null)}
        />
      )}

      {readingNode && (
        <ReadingPlayer
          body={readingNode.play.body || ''}
          title={readingNode.play.title || readingNode.node.title || 'Reading'}
          estimated_minutes={readingNode.play.estimated_minutes}
          onComplete={async () => {
            await completeNode(readingNode.node.id, readingNode.node.xp_reward);
            setReadingNode(null);
          }}
          onClose={() => setReadingNode(null)}
        />
      )}

      {embedPlay?.src && (
        <MissionOverlay
          src={embedPlay.src}
          title={embedPlay.title}
          name="stemverse-journey-activity"
          onComplete={async () => {
            await completeNode(embedPlay.node.id, embedPlay.node.xp_reward);
            setEmbedPlay(null);
          }}
        />
      )}

      {embedPlay?.arduino && (
        <div className="fixed inset-0 z-[200] bg-[#0a1628]">
          <ArduinoCodingMission
            missionTitle={embedPlay.title}
            onComplete={async () => {
              await completeNode(embedPlay.node.id, embedPlay.node.xp_reward);
              setEmbedPlay(null);
            }}
          />
        </div>
      )}

      {hardwareNode && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg rounded-2xl bg-[#0a1628] border border-slate-600 p-6 text-white"
          >
            <h3 className="text-lg font-bold">{hardwareNode.play.title || 'Hardware activity'}</h3>
            <p className="mt-2 text-sm text-slate-400">Complete this hands-on step, then mark it done.</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold"
                onClick={async () => {
                  const cfg = hardwareNode.play.hardware_config || {};
                  const mid = cfg.mission_id != null ? String(cfg.mission_id) : '';
                  if (mid && isUuid(mid)) {
                    stashPendingJourneyNode(hardwareNode.node);
                    onOpenMission(mid);
                    setHardwareNode(null);
                    return;
                  }
                  await completeNode(hardwareNode.node.id, hardwareNode.node.xp_reward);
                  setHardwareNode(null);
                }}
              >
                Continue
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm"
                onClick={() => setHardwareNode(null)}
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {!active ? (
        <div className="p-12 text-center text-slate-400">
          <p className="text-lg font-semibold">No journey deployed yet</p>
          <p className="text-sm mt-2">Your teacher will publish a path for this sector.</p>
        </div>
      ) : (
        <div className="px-4 py-8 max-w-lg mx-auto">
          <div className="space-y-0">
            {active.nodes.map((n, i) => {
              const completed = Boolean(n.is_completed);
              const unlocked = isNodeUnlocked(n, completedSet);
              const isActive = !completed && unlocked && String(n.id) === activeNodeId;
              const alignRight = i % 2 === 1;
              const theme = nodeTheme[n.node_type];
              const isBonus = Boolean(n.is_bonus);
              const connectorDone = completed;

              return (
                <div key={n.id} className="relative">
                  {i > 0 && (
                    <div
                      className={`mx-auto w-0.5 h-10 ${connectorDone ? 'bg-teal-400' : 'border-l-2 border-dashed border-slate-600 bg-transparent'}`}
                      style={{ marginLeft: alignRight ? 'auto' : 'calc(50% - 1px)', marginRight: alignRight ? 'calc(50% - 1px)' : 'auto', width: alignRight ? '2px' : undefined }}
                    />
                  )}
                  <div className={`flex ${alignRight ? 'justify-end' : 'justify-start'} px-2`}>
                    <button
                      type="button"
                      disabled={!unlocked && !completed}
                      onClick={() => void handleNodeClick(n, unlocked)}
                      className={`group relative flex flex-col items-center max-w-[200px] ${!unlocked && !completed ? 'cursor-not-allowed' : ''}`}
                    >
                      <motion.span
                        animate={
                          isActive
                            ? { scale: [1, 1.06, 1], boxShadow: ['0 0 0 0 rgba(45,212,191,0.4)', '0 0 20px 4px rgba(45,212,191,0.5)', '0 0 0 0 rgba(45,212,191,0.4)'] }
                            : undefined
                        }
                        transition={{ duration: 1.8, repeat: Infinity }}
                        className={`relative flex items-center justify-center ${
                          isBonus ? 'size-14 [clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]' : 'size-14 rounded-full'
                        } border-2 ${
                          completed
                            ? 'bg-teal-500 border-teal-300 text-white'
                            : isActive
                              ? `${theme.fill} border-white text-white ring-4 ${theme.ring}`
                              : unlocked
                                ? `${theme.fill} border-slate-400 text-white opacity-90`
                                : 'bg-slate-700 border-slate-600 text-slate-500'
                        }`}
                      >
                        {completed ? (
                          <CheckCircle2 className="size-6" />
                        ) : unlocked ? (
                          isBonus ? <Star className="size-5" /> : theme.icon
                        ) : (
                          <Lock className="size-4" />
                        )}
                      </motion.span>
                      <p className={`mt-2 text-center text-sm font-semibold ${isActive ? 'text-teal-200' : 'text-slate-200'}`}>
                        {n.title || n.node_type}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{n.node_type}</p>
                      {completed && (
                        <p className="text-xs font-bold text-teal-400 mt-0.5">+{n.xp_reward} XP</p>
                      )}
                      {isActive && (
                        <span className="mt-1 text-[10px] font-black uppercase text-teal-300">Tap to start</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {active.nodes.length === 0 && (
            <p className="text-center text-slate-500 text-sm">This journey has no activities yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
