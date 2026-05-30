import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { registerArduinoBlocklyDefinitions, TOOLBOX_CONFIG } from './BlockDefinitions';
import { buildArduinoCodeFromWorkspace } from './ArduinoGenerator';

export interface BlocklyEditorHandle {
  generateCode: () => string;
  saveWorkspaceJson: () => string;
  loadWorkspaceJson: (raw: string) => void;
  addBlock: (blockType: string) => void;
}

const BlocklyEditor = forwardRef<BlocklyEditorHandle, { onWorkspaceChanged?: () => void }>(
  ({ onWorkspaceChanged }, ref) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
    const initErrorRef = useRef<string | null>(null);

    useEffect(() => {
      if (!hostRef.current) return;
      registerArduinoBlocklyDefinitions();

      let workspace: Blockly.WorkspaceSvg;
      try {
        workspace = Blockly.inject(hostRef.current, {
          toolbox: TOOLBOX_CONFIG as any,
          renderer: 'zelos',
          trashcan: true,
          move: { wheel: true, drag: true, scrollbars: true },
          zoom: { controls: true, wheel: true, startScale: 0.95, minScale: 0.5, maxScale: 2.5 },
          grid: {
            spacing: 24,
            length: 3,
            colour: '#dbe3ef',
            snap: true,
          },
        });
      } catch (error) {
        initErrorRef.current = error instanceof Error ? error.message : 'Unknown Blockly error';
        if (hostRef.current) {
          hostRef.current.innerHTML =
            '<div style="padding:16px;font-family:monospace;color:#7f1d1d;background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;">Blockly failed to initialize. Reload page or check console.</div>';
        }
        return;
      }

      workspaceRef.current = workspace;

      const starter = workspace.newBlock('arduino_program_start');
      starter.initSvg();
      starter.render();
      starter.moveBy(48, 40);

      const listener = () => onWorkspaceChanged?.();
      workspace.addChangeListener(listener);
      Blockly.svgResize(workspace);

      const onResize = () => Blockly.svgResize(workspace);
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        workspace.dispose();
        workspaceRef.current = null;
      };
    }, [onWorkspaceChanged]);

    useImperativeHandle(ref, () => ({
      generateCode: () => {
        const ws = workspaceRef.current;
        if (!ws) return '';
        return buildArduinoCodeFromWorkspace(ws).arduinoCode;
      },
      saveWorkspaceJson: () => {
        const ws = workspaceRef.current;
        if (!ws) return '{}';
        return JSON.stringify(Blockly.serialization.workspaces.save(ws), null, 2);
      },
      loadWorkspaceJson: (raw: string) => {
        const ws = workspaceRef.current;
        if (!ws) return;
        const parsed = JSON.parse(raw);
        ws.clear();
        Blockly.serialization.workspaces.load(parsed, ws);
      },
      addBlock: (blockType: string) => {
        const ws = workspaceRef.current;
        if (!ws) return;
        const block = ws.newBlock(blockType);
        block.initSvg();
        block.render();
        block.moveBy(110 + Math.random() * 80, 110 + Math.random() * 60);
      },
    }));

    return <div ref={hostRef} className="h-full w-full rounded-xl border border-slate-200 bg-white" />;
  }
);

BlocklyEditor.displayName = 'BlocklyEditor';

export default BlocklyEditor;
