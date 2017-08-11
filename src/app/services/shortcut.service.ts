import { Injectable } from '@angular/core';
import { State, Store } from 'app/store';
import * as $ from 'jquery';
import { ActionCreators } from 'redux-undo';
import { Subject } from 'rxjs/Subject';

import { ActionModeService } from './actionmode.service';
import { AnimatorService } from './animator.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';

export enum Shortcut {
  ZoomToFit = 1,
}

interface ModifierKeyEvent {
  readonly metaKey: boolean;
  readonly ctrlKey?: boolean;
}

@Injectable()
export class ShortcutService {
  private isInit = false;
  private readonly shortcutSubject = new Subject<Shortcut>();

  static isMac() {
    return navigator.appVersion.includes('Mac');
  }

  static getOsDependentModifierKey(event: ModifierKeyEvent) {
    return !!(ShortcutService.isMac() ? !!event.metaKey : !!event.ctrlKey);
  }

  constructor(
    private readonly store: Store<State>,
    private readonly animatorService: AnimatorService,
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
      if (ShortcutService.getOsDependentModifierKey(event)) {
        if (event.keyCode === 'Z'.charCodeAt(0)) {
          event.shiftKey
            ? this.store.dispatch(ActionCreators.redo())
            : this.store.dispatch(ActionCreators.undo());
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
        // In case there's a JS error, never navigate away.
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
        // Spacebar.
        this.playbackService.toggleIsPlaying();
        return false;
      }
      if (event.keyCode === 37) {
        // Left arrow.
        this.animatorService.rewind();
        return false;
      }
      if (event.keyCode === 39) {
        // Right arrow.
        this.animatorService.fastForward();
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
