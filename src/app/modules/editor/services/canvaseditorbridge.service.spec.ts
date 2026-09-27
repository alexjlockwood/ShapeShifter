import type { CanvasEditorCommands } from 'app/modules/editor/components/canvas/CanvasEditorApi';
import { describe, expect, it, vi } from 'vitest';

import { CanvasEditorBridgeService } from './canvaseditorbridge.service';

describe('CanvasEditorBridgeService', () => {
  function newEditor(layerId: string) {
    const runCommand = vi.fn<CanvasEditorCommands['runCommand']>();
    const editor: CanvasEditorCommands = {
      getLayerAt: () => layerId,
      getMenuState: () => ({ editingLayerId: layerId }),
      runCommand,
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
});
