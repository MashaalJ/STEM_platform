import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, Download, Play, Save, Trash2, Upload } from 'lucide-react';
import BlocklyEditor, { type BlocklyEditorHandle } from './BlocklyEditor';
import { SIDEBAR_CATEGORIES } from './BlockDefinitions';
import { buildArduinoCodeFromWorkspace, runMockArduinoSimulation } from './ArduinoGenerator';
import * as Blockly from 'blockly';

const WORKSPACE_CACHE_KEY = 'stemverse_arduino_workspace_json';

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ArduinoCodingMission({
  missionId,
  missionTitle,
  onComplete,
}: {
  missionId?: number;
  missionTitle?: string;
  onComplete?: () => void;
}) {
  const editorRef = useRef<BlocklyEditorHandle | null>(null);
  const [generatedCode, setGeneratedCode] = useState('// Click Generate Code');
  const [serialOutput, setSerialOutput] = useState<string[]>([
    '[BOOT] STEMverse Arduino IDE ready',
    '[INFO] UNO mode enabled',
  ]);
  const [workspaceJsonDraft, setWorkspaceJsonDraft] = useState('');
  const [projectId, setProjectId] = useState('');
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    SIDEBAR_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {})
  );
  const [portHandle, setPortHandle] = useState<any>(null);

  const pushLog = (line: string) =>
    setSerialOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);

  const handleGenerate = () => {
    const ws = Blockly.getMainWorkspace();
    if (!ws) return;
    const result = buildArduinoCodeFromWorkspace(ws);
    setGeneratedCode(result.arduinoCode);
    pushLog('Arduino C++ generated');
  };

  const handleSaveLocal = () => {
    const raw = editorRef.current?.saveWorkspaceJson() || '{}';
    localStorage.setItem(WORKSPACE_CACHE_KEY, raw);
    setWorkspaceJsonDraft(raw);
    pushLog('Workspace saved locally');
  };

  const handleLoadLocal = () => {
    const raw = workspaceJsonDraft.trim() || localStorage.getItem(WORKSPACE_CACHE_KEY) || '';
    if (!raw) {
      pushLog('No saved workspace JSON found');
      return;
    }
    try {
      editorRef.current?.loadWorkspaceJson(raw);
      pushLog('Workspace loaded');
    } catch {
      pushLog('Invalid workspace JSON');
    }
  };

  const handleExportIno = () => {
    const code = editorRef.current?.generateCode() || generatedCode;
    downloadTextFile(`${(missionTitle || 'stemverse_arduino').replace(/\s+/g, '_')}.ino`, code);
    pushLog('.ino exported');
  };

  const connectToArduino = async () => {
    if (!(navigator as any).serial) {
      pushLog('WebSerial unavailable. Using simulation mode.');
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setPortHandle(port);
      setConnected(true);
      pushLog('Connected to Arduino Uno via WebSerial');
    } catch {
      pushLog('Board connection cancelled or failed');
    }
  };

  const runSimulation = () => {
    const ws = Blockly.getMainWorkspace();
    if (!ws) return;
    const built = buildArduinoCodeFromWorkspace(ws);
    setGeneratedCode(built.arduinoCode);
    const result = runMockArduinoSimulation(built.jsSource);
    result.logs.forEach((line) => pushLog(line));
    pushLog(result.success ? 'Simulation completed' : 'Simulation failed');
  };

  const handleUpload = async () => {
    handleGenerate();
    if (!connected || !portHandle) {
      pushLog('No board connected, running simulation fallback');
      runSimulation();
      return;
    }
    // Real Uno flashing needs compile + avrdude bridge; keep graceful stub.
    pushLog('Cloud compile request queued (stub)');
    pushLog('Upload to Uno requires compiler/uploader service bridge');
  };

  const saveProjectToBackend = async () => {
    const workspace_json = editorRef.current?.saveWorkspaceJson() || '{}';
    const generated = editorRef.current?.generateCode() || generatedCode;
    const body = {
      id: projectId ? Number(projectId) : undefined,
      mission_id: missionId,
      title: missionTitle || 'Arduino Mission Project',
      workspace_json,
      generated_code: generated,
    };
    const res = await fetch('/projects/save', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      pushLog(`Save failed: ${data.message || 'unknown error'}`);
      return;
    }
    if (data.id) setProjectId(String(data.id));
    pushLog(`Project saved (id: ${data.id})`);
  };

  const loadProjectFromBackend = async () => {
    if (!projectId) {
      pushLog('Enter project id first');
      return;
    }
    const res = await fetch(`/projects/${projectId}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.project) {
      pushLog(`Load failed: ${data.message || 'not found'}`);
      return;
    }
    const raw = String(data.project.workspace_json || '{}');
    try {
      editorRef.current?.loadWorkspaceJson(raw);
      setGeneratedCode(String(data.project.generated_code || generatedCode));
      setWorkspaceJsonDraft(raw);
      pushLog(`Project ${projectId} loaded`);
    } catch {
      pushLog('Loaded project contains invalid workspace JSON');
    }
  };

  const sidebar = useMemo(
    () =>
      SIDEBAR_CATEGORIES.map((cat) => (
        <div key={cat.id} className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setExpanded((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
            className="w-full flex items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: cat.color }}>
              {cat.label}
            </span>
            {expanded[cat.id] ? <ChevronDown className="size-4 text-slate-500" /> : <ChevronRight className="size-4 text-slate-500" />}
          </button>
          {expanded[cat.id] && (
            <div className="px-2 pb-2 space-y-1">
              {cat.blocks.map((b) => (
                <button
                  key={`${cat.id}-${b.type}`}
                  type="button"
                  onClick={() => editorRef.current?.addBlock(b.type)}
                  className="w-full min-h-11 px-2 rounded-lg text-left text-xs font-semibold border border-slate-200 hover:border-[#003c71] hover:bg-[#f1f7ff] text-slate-700"
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )),
    [expanded]
  );

  return (
    <div className="w-full min-h-[calc(100vh-6rem)] rounded-2xl border border-slate-200 bg-[#f8fafc] text-slate-900 p-3 sm:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px] gap-3 h-full">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#003c71]">Block Library</h3>
          {sidebar}
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 min-h-[720px]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-black text-[#003c71]">{missionTitle || 'Arduino Mission'}</p>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Zoom + Pan Enabled</span>
          </div>
          <div className="h-[calc(100vh-220px)] min-h-[680px] bg-[radial-gradient(circle_at_1px_1px,#d7dfec_1px,transparent_1px)] bg-[size:24px_24px] rounded-xl p-1">
            <BlocklyEditor ref={editorRef} onWorkspaceChanged={() => {}} />
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-col gap-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#003c71]">Controls</h3>

          <button type="button" onClick={connectToArduino} className="min-h-11 rounded-lg bg-[#003c71] text-white text-xs font-black uppercase tracking-wider">
            {connected ? 'Connected to Uno' : 'Connect to Arduino'}
          </button>
          <button type="button" onClick={handleUpload} className="min-h-11 rounded-lg bg-[#f7ba06] text-[#0f2348] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
            <Upload className="size-4" /> Upload Code
          </button>
          <button type="button" onClick={handleGenerate} className="min-h-11 rounded-lg border border-slate-300 text-slate-800 text-xs font-black uppercase tracking-wider">
            Generate Code
          </button>
          <button type="button" onClick={runSimulation} className="min-h-11 rounded-lg border border-slate-300 text-slate-800 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
            <Play className="size-4" /> Run Simulation
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={handleSaveLocal} className="min-h-11 rounded-lg border border-slate-300 text-xs font-semibold flex items-center justify-center gap-2"><Save className="size-4" /> Save</button>
            <button type="button" onClick={handleLoadLocal} className="min-h-11 rounded-lg border border-slate-300 text-xs font-semibold">Load</button>
          </div>
          <button type="button" onClick={handleExportIno} className="min-h-11 rounded-lg border border-slate-300 text-xs font-semibold flex items-center justify-center gap-2"><Download className="size-4" /> Export .ino</button>

          <div className="rounded-lg border border-slate-200 p-2 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Project API</p>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Project ID"
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={saveProjectToBackend} className="min-h-11 rounded-md bg-[#003c71] text-white text-xs font-semibold">Save API</button>
              <button type="button" onClick={loadProjectFromBackend} className="min-h-11 rounded-md border border-slate-300 text-xs font-semibold">Load API</button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Generated Arduino C++</p>
            <textarea readOnly value={generatedCode} className="w-full h-28 rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-[11px] font-mono text-slate-800" />
          </div>

          <div className="rounded-lg border border-slate-200 p-2 flex-1 min-h-[180px]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Serial Monitor</p>
              <button type="button" onClick={() => setSerialOutput([])} className="text-[11px] text-slate-500 flex items-center gap-1">
                <Trash2 className="size-3.5" /> Clear
              </button>
            </div>
            <div className="h-40 overflow-auto rounded-md border border-slate-300 bg-black px-2 py-2 text-[11px] font-mono text-emerald-400">
              {serialOutput.length ? serialOutput.map((line, idx) => <p key={`${line}-${idx}`}>{line}</p>) : <p>{'>'} monitor cleared</p>}
            </div>
          </div>

          <textarea
            value={workspaceJsonDraft}
            onChange={(e) => setWorkspaceJsonDraft(e.target.value)}
            placeholder="Workspace JSON (optional manual paste)"
            className="w-full h-20 rounded-lg border border-slate-300 px-2 py-2 text-[11px] font-mono"
          />

          <button
            type="button"
            onClick={onComplete}
            className="min-h-11 rounded-lg bg-[#003c71] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Cpu className="size-4" /> Complete Mission
          </button>
        </aside>
      </div>
    </div>
  );
}
