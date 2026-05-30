import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import type { ChallengeContent, CodingLabContent } from '../types';

export const defaultContent = (): CodingLabContent => ({
  title: 'Robot Route Logic',
  prompt:
    'Program the rover to scan for an obstacle, avoid it, then continue to the finish zone. Build your sequence and include the core safety checks in code.',
  mode: 'hybrid',
  toolbox: ['INIT', 'MOVE_FORWARD', 'SCAN', 'IF_OBSTACLE', 'TURN_LEFT', 'TURN_RIGHT', 'STOP'],
  targetSequence: ['INIT', 'SCAN', 'IF_OBSTACLE', 'TURN_RIGHT', 'MOVE_FORWARD', 'STOP'],
  starterCode: [
    'function runRobot() {',
    '  const obstacle = scanAhead();',
    '  if (obstacle) {',
    '    turnRight();',
    '  }',
    '  moveForward();',
    '  stopRobot();',
    '}',
  ].join('\n'),
  requiredSnippets: ['scanAhead', 'if (obstacle)', 'turnRight', 'moveForward', 'stopRobot'],
  passThreshold: 0.75,
});

const normalizeLines = (text: string) =>
  text
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);

const sequenceScore = (attempt: string[], target: string[]) => {
  if (!target.length) return 1;
  let matches = 0;
  target.forEach((step, idx) => {
    if ((attempt[idx] || '').trim().toUpperCase() === step.trim().toUpperCase()) matches += 1;
  });
  return matches / target.length;
};

const snippetScore = (code: string, snippets: string[]) => {
  if (!snippets.length) return 1;
  const base = code.toLowerCase();
  const hits = snippets.filter((s) => base.includes(String(s).toLowerCase())).length;
  return hits / snippets.length;
};

let blocklyRegistered = false;

const ensureBlocklyBlocks = () => {
  if (blocklyRegistered) return;
  Blockly.defineBlocksWithJsonArray([
    {
      type: 'mission_start',
      message0: 'when mission starts %1',
      args0: [{ type: 'input_statement', name: 'DO' }],
      colour: 230,
      tooltip: 'Top level mission program',
      helpUrl: '',
    },
    {
      type: 'robot_init',
      message0: 'init robot',
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },
    {
      type: 'robot_scan',
      message0: 'scan ahead',
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },
    {
      type: 'robot_move_forward',
      message0: 'move forward',
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },
    {
      type: 'robot_turn_left',
      message0: 'turn left',
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },
    {
      type: 'robot_turn_right',
      message0: 'turn right',
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },
    {
      type: 'robot_stop',
      message0: 'stop robot',
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },
    {
      type: 'robot_if_obstacle',
      message0: 'if obstacle ahead %1 do %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 30,
    },
  ]);

  javascriptGenerator.forBlock.mission_start = (block, generator) => {
    const statements = generator.statementToCode(block, 'DO');
    return `${statements}`;
  };
  javascriptGenerator.forBlock.robot_init = () => 'api.init();\n';
  javascriptGenerator.forBlock.robot_scan = () => 'api.scanAhead();\n';
  javascriptGenerator.forBlock.robot_move_forward = () => 'api.moveForward();\n';
  javascriptGenerator.forBlock.robot_turn_left = () => 'api.turnLeft();\n';
  javascriptGenerator.forBlock.robot_turn_right = () => 'api.turnRight();\n';
  javascriptGenerator.forBlock.robot_stop = () => 'api.stopRobot();\n';
  javascriptGenerator.forBlock.robot_if_obstacle = (block, generator) => {
    const statements = generator.statementToCode(block, 'DO');
    return `if (api.scanAhead()) {\n${statements}}\n`;
  };
  blocklyRegistered = true;
};

const blockNameToType: Record<string, string> = {
  INIT: 'robot_init',
  SCAN: 'robot_scan',
  MOVE_FORWARD: 'robot_move_forward',
  TURN_LEFT: 'robot_turn_left',
  TURN_RIGHT: 'robot_turn_right',
  STOP: 'robot_stop',
  IF_OBSTACLE: 'robot_if_obstacle',
};

export function evaluate(content: ChallengeContent, response: unknown): { score: number; correct: boolean; feedback?: string } {
  const c = content as CodingLabContent;
  const passThreshold = Math.max(0.4, Math.min(1, Number(c.passThreshold ?? 0.75)));
  const target = Array.isArray(c.targetSequence) ? c.targetSequence : [];
  const required = Array.isArray(c.requiredSnippets) ? c.requiredSnippets : [];
  const mode = c.mode || 'hybrid';

  const r = (response || {}) as { sequence?: unknown; code?: unknown };
  const attemptSequence = Array.isArray(r.sequence) ? r.sequence.map((x) => String(x)) : [];
  const code = String(r.code || '');

  const seq = sequenceScore(attemptSequence, target);
  const snp = snippetScore(code, required);
  const weighted =
    mode === 'blocks' ? seq : mode === 'code' ? snp : seq * 0.5 + snp * 0.5;
  const score = Math.max(0, Math.min(1, weighted));
  return {
    score,
    correct: score >= passThreshold,
    feedback:
      score >= passThreshold
        ? 'Great logic structure. Mission constraints satisfied.'
        : 'Keep refining your sequence and include all required safety snippets.',
  };
}

export function CodingLabEditor({
  content,
  onChange,
}: {
  content: ChallengeContent;
  onChange: (c: ChallengeContent) => void;
}) {
  const c = content as CodingLabContent;
  const update = (patch: Partial<CodingLabContent>) => onChange({ ...c, ...patch });

  return (
    <div className="space-y-4">
      <label className="block text-xs font-black text-slate-200 uppercase tracking-widest">Challenge prompt</label>
      <textarea
        value={c.prompt || ''}
        onChange={(e) => update({ prompt: e.target.value })}
        rows={4}
        className="w-full bg-[#f8fbff] border border-indigo-200 rounded-xl px-4 py-3 text-[#0f2348] placeholder:text-slate-500"
        placeholder="Describe the robotics/coding task..."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-slate-200 uppercase tracking-widest mb-1">Mode</label>
          <select
            value={c.mode || 'hybrid'}
            onChange={(e) => update({ mode: e.target.value as CodingLabContent['mode'] })}
            className="w-full bg-[#f8fbff] border border-indigo-200 rounded-xl px-3 py-2 text-[#0f2348] text-sm"
          >
            <option value="hybrid">Hybrid (Blocks + Code)</option>
            <option value="blocks">Blocks only</option>
            <option value="code">Code only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-black text-slate-200 uppercase tracking-widest mb-1">Pass threshold</label>
          <input
            type="number"
            min={0.4}
            max={1}
            step={0.05}
            value={Number(c.passThreshold ?? 0.75)}
            onChange={(e) => update({ passThreshold: Number(e.target.value || 0.75) })}
            className="w-full bg-[#f8fbff] border border-indigo-200 rounded-xl px-3 py-2 text-[#0f2348] text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-slate-200 uppercase tracking-widest mb-1">Toolbox blocks (line/comma separated)</label>
          <textarea
            rows={5}
            value={(c.toolbox || []).join('\n')}
            onChange={(e) => update({ toolbox: normalizeLines(e.target.value) })}
            className="w-full bg-[#f8fbff] border border-indigo-200 rounded-xl px-4 py-3 text-[#0f2348] font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-200 uppercase tracking-widest mb-1">Target sequence (line/comma separated)</label>
          <textarea
            rows={5}
            value={(c.targetSequence || []).join('\n')}
            onChange={(e) => update({ targetSequence: normalizeLines(e.target.value) })}
            className="w-full bg-[#f8fbff] border border-indigo-200 rounded-xl px-4 py-3 text-[#0f2348] font-mono text-sm"
          />
        </div>
      </div>

      <label className="block text-xs font-black text-slate-200 uppercase tracking-widest">Starter code</label>
      <textarea
        rows={8}
        value={c.starterCode || ''}
        onChange={(e) => update({ starterCode: e.target.value })}
        className="w-full bg-[#f8fbff] border border-indigo-200 rounded-xl px-4 py-3 text-[#0f2348] font-mono text-sm"
      />

      <label className="block text-xs font-black text-slate-200 uppercase tracking-widest">Required snippets (line/comma separated)</label>
      <textarea
        rows={4}
        value={(c.requiredSnippets || []).join('\n')}
        onChange={(e) => update({ requiredSnippets: normalizeLines(e.target.value) })}
        className="w-full bg-[#f8fbff] border border-indigo-200 rounded-xl px-4 py-3 text-[#0f2348] font-mono text-sm"
      />
    </div>
  );
}

export function CodingLabPlayer({
  content,
  onComplete,
  disabled,
}: {
  content: ChallengeContent;
  onComplete: (response: unknown) => void;
  disabled?: boolean;
}) {
  const c = content as CodingLabContent;
  const mode = c.mode || 'hybrid';
  const blocklyHostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [manualCode, setManualCode] = useState(c.starterCode || '');
  const [runLog, setRunLog] = useState<string>('');
  const [robotState, setRobotState] = useState<{ position: number; direction: number; obstacleSeen: boolean; running: boolean }>({
    position: 0,
    direction: 1,
    obstacleSeen: false,
    running: false,
  });

  const canUseBlocks = mode === 'blocks' || mode === 'hybrid';
  const canUseCode = mode === 'code' || mode === 'hybrid';

  const stepsPreview = useMemo(() => (c.targetSequence || []).join(' -> '), [c.targetSequence]);

  useEffect(() => {
    if (!canUseBlocks || !blocklyHostRef.current) return;
    ensureBlocklyBlocks();
    const blockTypes = (c.toolbox || [])
      .map((item) => blockNameToType[item] || '')
      .filter(Boolean);
    const toolboxXml = `<xml>${blockTypes.map((t) => `<block type="${t}"></block>`).join('')}</xml>`;
    const workspace = Blockly.inject(blocklyHostRef.current, {
      toolbox: toolboxXml,
      trashcan: true,
      renderer: 'zelos',
      move: { wheel: true, drag: true, scrollbars: true },
      zoom: { controls: true, wheel: true },
    });
    workspaceRef.current = workspace;
    const starter = workspace.newBlock('mission_start');
    starter.initSvg();
    starter.render();
    starter.moveBy(40, 30);

    const refreshCode = () => {
      try {
        const code = javascriptGenerator.workspaceToCode(workspace);
        setGeneratedCode(code.trim());
      } catch {
        setGeneratedCode('');
      }
    };
    workspace.addChangeListener(refreshCode);
    refreshCode();
    return () => {
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [canUseBlocks, c.toolbox]);

  const runCompiledProgram = (codeToRun: string) => {
    const actions: string[] = [];
    let position = 0;
    let direction = 1;
    let obstacleSeen = false;
    let running = false;
    const obstacleAt = 2;

    const api = {
      init: () => {
        running = true;
        position = 0;
        direction = 1;
        actions.push('INIT');
      },
      scanAhead: () => {
        obstacleSeen = true;
        actions.push('SCAN');
        return position + direction === obstacleAt;
      },
      moveForward: () => {
        actions.push('MOVE_FORWARD');
        if (position + direction !== obstacleAt) position += direction;
      },
      turnLeft: () => {
        actions.push('TURN_LEFT');
        direction = -1;
      },
      turnRight: () => {
        actions.push('TURN_RIGHT');
        direction = 1;
      },
      stopRobot: () => {
        actions.push('STOP');
        running = false;
      },
    };

    try {
      // The generated code only has access to controlled robotics API.
      const fn = new Function('api', `"use strict";\n${codeToRun}`);
      fn(api);
      setRobotState({ position, direction, obstacleSeen, running });
      setRunLog(`Compiled and executed.\nActions: ${actions.join(' -> ') || 'none'}`);
      return { sequence: actions, code: codeToRun };
    } catch (err) {
      setRunLog(`Compile/run error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return { sequence: actions, code: codeToRun };
    }
  };

  const handleCompileAndSubmit = () => {
    const source =
      mode === 'blocks'
        ? generatedCode
        : mode === 'code'
          ? manualCode
          : `${generatedCode}\n${manualCode}`;
    const payload = runCompiledProgram(source);
    onComplete(payload);
  };

  return (
    <div className="relative min-h-screen w-full px-4 sm:px-8 py-10 overflow-y-auto">
      <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_30%_20%,_#17325b_0%,_#09162e_45%,_#050a18_100%)]" />
      <div className="mx-auto max-w-6xl rounded-3xl border border-indigo-200 bg-[rgba(249,251,255,0.97)] p-5 sm:p-7 shadow-[0_20px_55px_rgba(8,12,24,0.5)]">
        <h3 className="text-xl sm:text-2xl text-[#0f2348] font-black tracking-tight">Advanced Coding Lab</h3>
        <p className="mt-3 text-[#243b67] text-sm sm:text-base font-medium">{c.prompt}</p>

        {canUseBlocks && (
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-[#1c325d] font-black mb-3">Block toolbox</p>
            <div
              ref={blocklyHostRef}
              className="w-full min-h-[380px] rounded-xl border border-indigo-200 bg-[#f8fbff] overflow-hidden"
            />
            <div className="mt-4 rounded-xl border border-indigo-200 bg-[#f8fbff] p-3">
              <p className="text-[11px] uppercase tracking-widest text-[#1c325d] font-black mb-2">Generated code (from blocks)</p>
              <pre className="text-[#0f2348] text-sm font-mono whitespace-pre-wrap">{generatedCode || '// Drag and snap blocks to generate code'}</pre>
            </div>
          </div>
        )}

        {canUseCode && (
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-[#1c325d] font-black mb-3">Code editor</p>
            <textarea
              rows={11}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              disabled={disabled}
              className="w-full rounded-xl border border-indigo-200 bg-[#f8fbff] px-4 py-3 text-[#0f2348] font-mono text-sm leading-6"
            />
          </div>
        )}

        <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-3">
          <p className="text-xs text-[#1c325d] font-black uppercase tracking-wider mb-2">Simulator output</p>
          <p className="text-sm text-[#243b67]">
            Position: <span className="font-mono">{robotState.position}</span> | Direction:{' '}
            <span className="font-mono">{robotState.direction === 1 ? 'forward' : 'backward'}</span> | Obstacle seen:{' '}
            <span className="font-mono">{robotState.obstacleSeen ? 'yes' : 'no'}</span> | Running:{' '}
            <span className="font-mono">{robotState.running ? 'yes' : 'no'}</span>
          </p>
          <pre className="mt-2 text-xs text-[#0f2348] whitespace-pre-wrap">{runLog || 'Compile and run to see execution log.'}</pre>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs text-[#1c325d] font-semibold">
            Mission target sequence: <span className="font-mono">{stepsPreview || 'Set by teacher'}</span>
          </p>
          <button
            type="button"
            onClick={handleCompileAndSubmit}
            disabled={disabled}
            className="min-h-11 rounded-xl bg-[#ffb204] px-5 text-[#0A192F] font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            Compile, Run, Submit
          </button>
        </div>
      </div>
    </div>
  );
}
