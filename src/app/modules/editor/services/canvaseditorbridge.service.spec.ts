import type { CanvasEditorCommands } from 'app/modules/editor/components/canvas/CanvasEditorApi';
import { Path } from 'app/modules/editor/model/paths';
import { describe, expect, it, vi } from 'vitest';

import { CanvasEditorBridgeService } from './canvaseditorbridge.service';

describe('CanvasEditorBridgeService', () => {
  function newEditor(layerId: string) {
    const runCommand = vi.fn<CanvasEditorCommands['runCommand']>();
    const editor: CanvasEditorCommands = {
      getLayerAt: () => layerId,
      getMenuState: () => ({ editingLayerId: layerId }),
      runCommand,
      startPointEdit: () => true,
      stopPointEdit: () => {},
      setSelectedAnchorIds: () => {},
      editPoints: () => {},
      runPointCommand: () => {},
      selectPointAt: () => {},
    };
    return { editor, runCommand };
  }

  it('does nothing without an editor, as on the live site', () => {
    const bridge = new CanvasEditorBridgeService();
    expect(bridge.isAvailable()).toBe(false);
    expect(bridge.getMenuState()).toBeUndefined();
    expect(bridge.getLayerAt({ x: 0, y: 0 })).toBeUndefined();
    bridge.runCommand('duplicate');
  });

  it('reaches the attached editor until it is detached', () => {
    const bridge = new CanvasEditorBridgeService();
    const { editor: first, runCommand } = newEditor('first');
    const { editor: second } = newEditor('second');
    bridge.attach(first);
    expect(bridge.getMenuState()).toEqual({ editingLayerId: 'first' });
    bridge.runCommand('outline');
    expect(runCommand).toHaveBeenCalledWith('outline');

    // A new canvas's editor replaces it, and the old one going away later leaves the new one.
    bridge.attach(second);
    bridge.detach(first);
    expect(bridge.getLayerAt({ x: 0, y: 0 })).toBe('second');
    bridge.detach(second);
    expect(bridge.isAvailable()).toBe(false);
  });

  it("tells subscribers what the attached editor edits, and forgets it when it's detached", () => {
    const bridge = new CanvasEditorBridgeService();
    const { editor } = newEditor('path');
    const { editor: other } = newEditor('other');
    const listener = vi.fn<() => void>();
    const unsubscribe = bridge.subscribe(listener);
    bridge.attach(editor);
    expect(bridge.getState()).toEqual({ isAvailable: true, pointEdit: undefined });
    expect(listener).toHaveBeenCalledTimes(1);

    const path = new Path('M 0 0 L 1 1');
    const pointEdit = { layerId: 'path', path, selectedAnchorIds: new Set(['a']) };
    bridge.reportPointEdit(editor, pointEdit);
    expect(bridge.getState().pointEdit).toBe(pointEdit);
    expect(listener).toHaveBeenCalledTimes(2);
    // The same path and selection again don't re-render the inspector.
    bridge.reportPointEdit(editor, { ...pointEdit, selectedAnchorIds: new Set(['a']) });
    expect(bridge.getState().pointEdit).toBe(pointEdit);
    expect(listener).toHaveBeenCalledTimes(2);
    // Nor does an editor that isn't attached.
    bridge.reportPointEdit(other, undefined);
    expect(bridge.getState().pointEdit).toBe(pointEdit);

    bridge.detach(editor);
    expect(bridge.getState()).toEqual({ isAvailable: false, pointEdit: undefined });
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    bridge.attach(editor);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
