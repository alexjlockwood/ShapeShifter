import { Injectable } from '@angular/core';
import { State, Store } from 'app/modules/editor/store';
import { environment } from 'environments/environment';
import * as $ from 'jquery';
import { ActionCreators } from 'redux-undo';
import { Subject } from 'rxjs';

import { ActionModeService } from './actionmode.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';

export enum Shortcut {
  ZoomToFit = 1,
}

interface ModifierKeyEvent {
  readonly metaKey: boolean;
  readonly ctrlKey?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private isInit = false;
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
  ) {}

  asObservable() {
    return this.shortcutSubject.asObservable();
  }

  init() {
    if (this.isInit) {
      return;
    }
    this.isInit = true;

    $(window).on('keydown', event => {
      if (ShortcutService.isOsDependentModifierKey(event)) {
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
      }
      if (event.ctrlKey || event.metaKey) {
        // Do nothing if the ctrl or meta keys are pressed.
        return undefined;
      }
      if (document.activeElement.matches('input')) {
        // Ignore shortcuts when an input element has focus.
        return true;
      }
      if (event.keyCode === 8 || event.keyCode === 46) {
        // Backspace or delete.
        const isActionMode = this.actionModeService.isActionMode();
        // If we aren't in beta or it is action mode, handle the backspace/delete
        // event here. Otherwise we will handle it in the gesture tool (which is
        // where we will likely want to move all of the shortcut logic in the future).
        if (!environment.beta || isActionMode) {
          // In case there's a JS error, never navigate away.
          event.preventDefault();
          if (isActionMode) {
            this.actionModeService.deleteSelectedActionModeModels();
          } else {
            this.layerTimelineService.deleteSelectedModels();
          }
          return false;
        }
      }
      if (event.keyCode === 27) {
        // Escape.
        this.actionModeService.closeActionMode();
        return false;
      }
      // TODO: figure out how to re-enable this keyboard shortcut in beta
      if (!environment.beta && event.keyCode === 32) {
        // Spacebar.
        this.playbackService.toggleIsPlaying();
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
    });
  }

  destroy() {
    if (!this.isInit) {
      return;
    }
    this.isInit = false;
    $(window).unbind('keydown');
  }

  getZoomToFitText() {
    return `${this.getCmdOrCtrlText()} + O`;
  }

  private getCmdOrCtrlText() {
    return ShortcutService.isMac() ? 'Cmd' : 'Ctrl';
  }
}
