import { on } from 'app/modules/editor/scripts/dom';
import { State, Store } from 'app/modules/editor/store';
import type { Features } from 'environments/features';
import { ActionCreators } from 'redux-undo';
import { Subject } from 'rxjs';

import { ActionModeService } from './actionmode.service';
import type { CanvasViewportService, ZoomCommand } from './canvasviewport.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';

export enum Shortcut {
  ZoomToFit = 1,
}

/** The elements that type text, where shortcuts like select all belong to the browser. */
export const TEXT_FIELD_SELECTOR =
  'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, [contenteditable]';

interface ModifierKeyEvent {
  readonly metaKey: boolean;
  readonly ctrlKey?: boolean;
}

interface ShortcutKeyEvent extends ModifierKeyEvent {
  readonly key: string;
  readonly code: string;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/**
 * Returns whether the key press is Cmd+A (Ctrl+A outside of Macs), with no other modifiers. It
 * goes by the key's position on layouts without Latin letters, e.g. Cyrillic. Both the canvas
 * editor and the shortcuts here use it, so it lives outside the editor's lazy chunk.
 */
export function isSelectAllShortcut(event: ShortcutKeyEvent, isMac: boolean) {
  const [command, other] = isMac ? [event.metaKey, event.ctrlKey] : [event.ctrlKey, event.metaKey];
  const isA = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() === 'a' : event.code === 'KeyA';
  return !!command && !other && !event.shiftKey && !event.altKey && isA;
}

/**
 * Returns the canvas zoom that the key press asks for, using Figma's shortcuts: Cmd with plus or
 * minus zooms in and out (Ctrl on other platforms), Shift+1 fits, and Shift+0 zooms to 100%.
 * (Cmd+1 and Cmd+0 belong to the browser.)
 */
export function getZoomShortcut(event: ShortcutKeyEvent, isMac: boolean): ZoomCommand | undefined {
  if ((isMac ? event.metaKey : event.ctrlKey) && !event.altKey) {
    // With or without Shift, since plus is Shift+= on most keyboards.
    if (['=', '+'].includes(event.key) || ['Equal', 'NumpadAdd'].includes(event.code)) {
      return 'in';
    }
    if (event.key === '-' || ['Minus', 'NumpadSubtract'].includes(event.code)) {
      return 'out';
    }
    return undefined;
  }
  if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
    // The key is '!' or ')' with Shift, and depends on the keyboard layout.
    if (event.code === 'Digit1') {
      return 'fit';
    }
    if (event.code === 'Digit0') {
      return '100%';
    }
  }
  return undefined;
}

/**
 * Returns whether a right-click should open the browser's menu. It's about the page rather than
 * the editor, so it only opens where it has something to offer: over text fields (for copying,
 * pasting, and spelling) and links (to open or copy them). Not over selected text: Safari selects
 * the word under the pointer before the event, so any text would count. The canvas, the layer
 * list, and the timeline open the app's own menu instead, and stop the browser's before the
 * window hears about it.
 */
export function shouldOpenBrowserContextMenu(target: EventTarget | null) {
  const element =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return !!element && (!!element.closest(TEXT_FIELD_SELECTOR) || !!element.closest('a[href]'));
}

export class ShortcutService {
  private removeListeners: ReadonlyArray<() => void> | undefined;
  private readonly shortcutSubject = new Subject<Shortcut>();

  /** Returns true if the event is a modifier key (meta for Macs, ctrl for others). */
  static isOsDependentModifierKey(event: ModifierKeyEvent) {
    return !!(ShortcutService.isMac() ? !!event.metaKey : !!event.ctrlKey);
  }

  static isMac() {
    return navigator.appVersion.includes('Mac');
  }

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
    private readonly playbackService: PlaybackService,
    private readonly layerTimelineService: LayerTimelineService,
    private readonly canvasViewportService: CanvasViewportService,
    private readonly features: Features,
  ) {}

  asObservable() {
    return this.shortcutSubject.asObservable();
  }

  init() {
    if (this.removeListeners) {
      return;
    }
    const canPan = this.features.canvasEditor;
    this.removeListeners = [
      on(window, 'keydown', event => this.onKeyDown(event)),
      on(window, 'contextmenu', event => {
        if (!shouldOpenBrowserContextMenu(event.target)) {
          event.preventDefault();
        }
      }),
      ...(canPan
        ? [
            on(window, 'keyup', event => this.onKeyUp(event)),
            // The key's release won't arrive once the window loses focus.
            on(window, 'blur', () => this.canvasViewportService.cancelSpace()),
            on(document, 'visibilitychange', () => this.canvasViewportService.cancelSpace()),
          ]
        : []),
    ];
  }

  private onKeyDown(event: KeyboardEvent) {
    if (event.target instanceof Element && event.target.closest('.MuiModal-root')) {
      // Leave the keys to the open dialog or menu, but still keep browsers that go back on
      // backspace (e.g. WebKit without Safari's settings) from leaving the page.
      if (event.keyCode === 8 && !event.target.matches(TEXT_FIELD_SELECTOR)) {
        event.preventDefault();
      }
      return undefined;
    }
    const zoom = this.features.canvasEditor
      ? getZoomShortcut(event, ShortcutService.isMac())
      : undefined;
    if (ShortcutService.isOsDependentModifierKey(event)) {
      if (zoom) {
        // Even while typing, so that the browser doesn't zoom the page instead.
        this.canvasViewportService.zoom(zoom);
        return false;
      }
      if (event.keyCode === 'Z'.charCodeAt(0)) {
        this.store.dispatch(event.shiftKey ? ActionCreators.redo() : ActionCreators.undo());
        return false;
      }
      if (event.keyCode === 'G'.charCodeAt(0)) {
        this.layerTimelineService.groupOrUngroupSelectedLayers(!event.shiftKey);
        return false;
      }
      if (event.keyCode === 'O'.charCodeAt(0)) {
        this.shortcutSubject.next(Shortcut.ZoomToFit);
        return false;
      }
      if (
        isSelectAllShortcut(event, ShortcutService.isMac()) &&
        !event.defaultPrevented &&
        !document.activeElement?.matches(TEXT_FIELD_SELECTOR) &&
        !this.actionModeService.isActionMode()
      ) {
        // Selects every visible layer rather than the page's text. Once the canvas editor has
        // loaded, it handles this first and stops the event, e.g. to select every point of the
        // path being edited, so this is for when it's off or still loading.
        this.layerTimelineService.selectAllLayers();
        return false;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      // Do nothing if the ctrl or meta keys are pressed.
      return undefined;
    }
    if (document.activeElement?.matches('input')) {
      // Ignore shortcuts when an input element has focus.
      return true;
    }
    if (zoom) {
      this.canvasViewportService.zoom(zoom);
      return false;
    }
    if (event.keyCode === 8 || event.keyCode === 46) {
      // Backspace or delete. In case there's a JS error, never navigate away.
      event.preventDefault();
      if (this.actionModeService.isActionMode()) {
        this.actionModeService.deleteSelectedActionModeModels();
      } else {
        this.layerTimelineService.deleteSelectedModels();
      }
      return false;
    }
    if (event.keyCode === 27) {
      // Escape.
      this.actionModeService.closeActionMode();
      return false;
    }
    if (event.keyCode === 32) {
      // Spacebar. When the canvas can pan, holding it pans, and releasing it plays or pauses.
      if (this.features.canvasEditor) {
        this.canvasViewportService.pressSpace(event);
      } else {
        this.playbackService.toggleIsPlaying();
      }
      return false;
    }
    if (event.keyCode === 37) {
      // Left arrow.
      this.playbackService.rewind();
      return false;
    }
    if (event.keyCode === 39) {
      // Right arrow.
      this.playbackService.fastForward();
      return false;
    }
    if (event.keyCode === 'R'.charCodeAt(0)) {
      if (this.actionModeService.isShowingSubPathActionMode()) {
        this.actionModeService.reverseSelectedSubPaths();
      } else {
        this.playbackService.toggleIsRepeating();
      }
      return false;
    }
    if (event.keyCode === 'S'.charCodeAt(0)) {
      if (
        this.actionModeService.isShowingSubPathActionMode() ||
        this.actionModeService.isShowingSegmentActionMode()
      ) {
        this.actionModeService.toggleSplitSubPathsMode();
      } else {
        this.playbackService.toggleIsSlowMotion();
      }
      return false;
    }
    if (event.keyCode === 'A'.charCodeAt(0)) {
      if (
        this.actionModeService.isShowingSubPathActionMode() ||
        this.actionModeService.isShowingSegmentActionMode()
      ) {
        this.actionModeService.toggleSplitCommandsMode();
      } else if (this.actionModeService.isShowingPointActionMode()) {
        this.actionModeService.splitSelectedPointInHalf();
      }
      return false;
    }
    if (event.keyCode === 'D'.charCodeAt(0)) {
      if (
        this.actionModeService.isShowingSubPathActionMode() ||
        this.actionModeService.isShowingSegmentActionMode()
      ) {
        this.actionModeService.togglePairSubPathsMode();
      }
      return false;
    }
    if (event.keyCode === 'B'.charCodeAt(0)) {
      if (this.actionModeService.isShowingSubPathActionMode()) {
        this.actionModeService.shiftBackSelectedSubPaths();
      }
      return false;
    }
    if (event.keyCode === 'F'.charCodeAt(0)) {
      if (this.actionModeService.isShowingSubPathActionMode()) {
        this.actionModeService.shiftForwardSelectedSubPaths();
      } else if (this.actionModeService.isShowingPointActionMode()) {
        this.actionModeService.shiftPointToFront();
      }
      return false;
    }
    return undefined;
  }

  private onKeyUp(event: KeyboardEvent) {
    if (event.key === 'Meta' && ShortcutService.isMac()) {
      // macOS doesn't send the release of a key that comes up while Cmd is held, so a space bar
      // that was let go while zooming with Cmd would otherwise stay held.
      this.canvasViewportService.cancelSpace();
      return undefined;
    }
    // Only the presses that were taken here, so that the space bar still presses a focused button
    // or checkbox, e.g. in a dialog.
    if (event.keyCode !== 32 || !this.canvasViewportService.isSpaceHeld()) {
      return undefined;
    }
    // A tap plays or pauses, unless the canvas panned in between.
    if (this.canvasViewportService.releaseSpace()) {
      this.playbackService.toggleIsPlaying();
    }
    return false;
  }

  destroy() {
    this.removeListeners?.forEach(remove => remove());
    this.removeListeners = undefined;
  }

  getZoomToFitText() {
    return `${this.getCmdOrCtrlText()} + O`;
  }

  private getCmdOrCtrlText() {
    return ShortcutService.isMac() ? 'Cmd' : 'Ctrl';
  }
}
