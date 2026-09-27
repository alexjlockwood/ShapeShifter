import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation } from 'app/modules/editor/model/timeline';
import { createEditorStore } from 'app/modules/editor/store';
import { getIsPlaying } from 'app/modules/editor/store/playback/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { NO_FEATURES } from 'environments/features';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ZoomCommand } from './canvasviewport.service';
import { createEditorServices, type EditorServices } from './createEditorServices';
import { getZoomShortcut, ShortcutService } from './shortcut.service';

const NO_KEYS = {
  key: '',
  code: '',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe('getZoomShortcut', () => {
  it('zooms in and out with Cmd on Macs, and Ctrl elsewhere', () => {
    const cmd = { ...NO_KEYS, metaKey: true };
    const ctrl = { ...NO_KEYS, ctrlKey: true };
    expect(getZoomShortcut({ ...cmd, key: '=', code: 'Equal' }, true)).toBe('in');
    expect(getZoomShortcut({ ...cmd, key: '+', code: 'Equal', shiftKey: true }, true)).toBe('in');
    expect(getZoomShortcut({ ...cmd, key: '+', code: 'NumpadAdd' }, true)).toBe('in');
    expect(getZoomShortcut({ ...cmd, key: '-', code: 'Minus' }, true)).toBe('out');
    expect(getZoomShortcut({ ...cmd, key: '-', code: 'NumpadSubtract' }, true)).toBe('out');
    expect(getZoomShortcut({ ...ctrl, key: '=', code: 'Equal' }, false)).toBe('in');
    expect(getZoomShortcut({ ...ctrl, key: '=', code: 'Equal' }, true)).toBeUndefined();
    expect(getZoomShortcut({ ...cmd, key: '=', code: 'Equal' }, false)).toBeUndefined();
  });

  it('fits with Shift+1 and zooms to 100% with Shift+0, whatever the keys type', () => {
    const shift = { ...NO_KEYS, shiftKey: true };
    expect(getZoomShortcut({ ...shift, key: '!', code: 'Digit1' }, true)).toBe('fit');
    expect(getZoomShortcut({ ...shift, key: ')', code: 'Digit0' }, true)).toBe('100%');
    // A French keyboard.
    expect(getZoomShortcut({ ...shift, key: '1', code: 'Digit1' }, false)).toBe('fit');
    expect(getZoomShortcut({ ...NO_KEYS, key: '1', code: 'Digit1' }, true)).toBeUndefined();
    expect(getZoomShortcut({ ...shift, metaKey: true, key: '1', code: 'Digit1' }, true)).toBe(
      undefined,
    );
  });

  it('leaves other keys alone', () => {
    expect(getZoomShortcut({ ...NO_KEYS, key: '=', code: 'Equal' }, true)).toBeUndefined();
    expect(getZoomShortcut({ ...NO_KEYS, metaKey: true, key: 'z', code: 'KeyZ' }, true)).toBe(
      undefined,
    );
  });
});

describe('ShortcutService', () => {
  let services: EditorServices | undefined;

  afterEach(() => {
    services?.dispose();
    services = undefined;
  });

  function setUp(canvasEditor: boolean) {
    const store = createEditorStore({ logActions: false });
    services = createEditorServices(store, { features: { ...NO_FEATURES, canvasEditor } });
    services.shortcutService.init();
    const isPlaying = () => getIsPlaying(store.getState());
    return { services, store, isPlaying };
  }

  function press(type: 'keydown' | 'keyup', init: KeyboardEventInit) {
    const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
  }

  it('plays and pauses when Space goes down, without the canvas editor', () => {
    const { isPlaying } = setUp(false);
    press('keydown', { key: ' ', keyCode: 32 });
    expect(isPlaying()).toBe(true);
    press('keyup', { key: ' ', keyCode: 32 });
    expect(isPlaying()).toBe(true);
  });

  it('plays and pauses when Space is tapped, and pans while it is held', () => {
    const { services, isPlaying } = setUp(true);
    const { canvasViewportService } = services;
    expect(press('keydown', { key: ' ', keyCode: 32 }).defaultPrevented).toBe(true);
    expect(canvasViewportService.isSpaceHeld()).toBe(true);
    expect(isPlaying()).toBe(false);
    press('keyup', { key: ' ', keyCode: 32 });
    expect(isPlaying()).toBe(true);

    press('keydown', { key: ' ', keyCode: 32 });
    press('keydown', { key: ' ', keyCode: 32, repeat: true });
    canvasViewportService.notePan();
    press('keyup', { key: ' ', keyCode: 32 });
    expect(isPlaying()).toBe(true);
    expect(canvasViewportService.isSpaceHeld()).toBe(false);
  });

  it('forgets that Space is held when the window loses focus', () => {
    const { services, isPlaying } = setUp(true);
    press('keydown', { key: ' ', keyCode: 32 });
    window.dispatchEvent(new Event('blur'));
    expect(services.canvasViewportService.isSpaceHeld()).toBe(false);
    press('keyup', { key: ' ', keyCode: 32 });
    expect(isPlaying()).toBe(false);
  });

  it('zooms the canvas, and keeps the browser from zooming the page', () => {
    const { services } = setUp(true);
    const commands: ZoomCommand[] = [];
    services.canvasViewportService.getZoomCommands().subscribe(c => commands.push(c));
    const modifiers = { metaKey: true, ctrlKey: true };
    expect(press('keydown', { ...modifiers, key: '=', code: 'Equal' }).defaultPrevented).toBe(true);
    press('keydown', { ...modifiers, key: '-', code: 'Minus' });
    press('keydown', { shiftKey: true, key: '!', code: 'Digit1' });
    press('keydown', { shiftKey: true, key: ')', code: 'Digit0' });
    expect(commands).toEqual(['in', 'out', 'fit', '100%']);
  });

  it('zooms while typing, but lets Shift+1 type', () => {
    const { services } = setUp(true);
    const commands: ZoomCommand[] = [];
    services.canvasViewportService.getZoomCommands().subscribe(c => commands.push(c));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    press('keydown', { metaKey: true, ctrlKey: true, key: '=', code: 'Equal' });
    expect(press('keydown', { shiftKey: true, key: '!', code: 'Digit1' }).defaultPrevented).toBe(
      false,
    );
    expect(commands).toEqual(['in']);
    input.remove();
  });

  it('leaves the space bar alone when it went down elsewhere, e.g. on a dialog button', () => {
    const { services, isPlaying } = setUp(true);
    const dialog = document.createElement('div');
    dialog.className = 'MuiModal-root';
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    const keyDown = new KeyboardEvent('keydown', { key: ' ', keyCode: 32, bubbles: true });
    button.dispatchEvent(keyDown);
    expect(services.canvasViewportService.isSpaceHeld()).toBe(false);
    // Browsers press the button when the key comes up, unless its default is prevented.
    const keyUp = new KeyboardEvent('keyup', {
      key: ' ',
      keyCode: 32,
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(keyUp);
    expect(keyUp.defaultPrevented).toBe(false);
    expect(isPlaying()).toBe(false);
    dialog.remove();
  });

  it('forgets that Space is held when Cmd comes up on a Mac', () => {
    vi.spyOn(ShortcutService, 'isMac').mockReturnValue(true);
    const { services } = setUp(true);
    press('keydown', { key: ' ', keyCode: 32 });
    // macOS doesn't send the space bar's release while Cmd is held.
    press('keyup', { key: 'Meta', metaKey: false });
    expect(services.canvasViewportService.isSpaceHeld()).toBe(false);
    vi.restoreAllMocks();
  });

  it('selects every layer with Cmd+A, except in a text field', () => {
    const { services, store } = setUp(false);
    const { layerTimelineService } = services;
    const children = ['a', 'b'].map(
      name => new PathLayer({ name, children: [], pathData: new Path('M 1 1 L 5 1') }),
    );
    store.dispatch(
      new ResetWorkspace(new VectorLayer({ name: 'vector', children }), new Animation()),
    );
    const modifiers = { metaKey: true, ctrlKey: true };
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(press('keydown', { ...modifiers, key: 'a', keyCode: 65 }).defaultPrevented).toBe(false);
    expect(layerTimelineService.getSelectedLayers()).toEqual([]);
    input.remove();

    expect(press('keydown', { ...modifiers, key: 'a', keyCode: 65 }).defaultPrevented).toBe(true);
    expect(layerTimelineService.getSelectedLayers().map(l => l.name)).toEqual(['a', 'b']);
  });

  it("doesn't zoom without the canvas editor", () => {
    const { services } = setUp(false);
    const commands: ZoomCommand[] = [];
    services.canvasViewportService.getZoomCommands().subscribe(c => commands.push(c));
    const event = press('keydown', { metaKey: true, ctrlKey: true, key: '=', code: 'Equal' });
    expect(event.defaultPrevented).toBe(false);
    expect(commands).toEqual([]);
  });
});
