import { Injectable } from '@angular/core';
import { ActionModeService } from 'app/services/actionmode/actionmode.service';
import { AnimatorService } from 'app/services/animator/animator.service';
import {
  State,
  Store,
} from 'app/store';
import { DeleteSelectedModels } from 'app/store/common/actions';
import { GroupOrUngroupSelectedLayers } from 'app/store/layers/actions';
import * as $ from 'jquery';
import { ActionCreators } from 'redux-undo';

@Injectable()
export class ShortcutService {
  private isInit = false;

  constructor(
    private readonly store: Store<State>,
    private readonly animatorService: AnimatorService,
    private readonly actionModeService: ActionModeService,
  ) { }

  init() {
    if (this.isInit) {
      return;
    }
    this.isInit = true;

    $(window).on('keydown', event => {
      if (event.metaKey && event.keyCode === 'Z'.charCodeAt(0)) {
        // Z.
        event.shiftKey
          ? this.store.dispatch(ActionCreators.redo())
          : this.store.dispatch(ActionCreators.undo());
        return false;
      }
      if (event.metaKey && event.keyCode === 'G'.charCodeAt(0)) {
        // G.
        this.store.dispatch(new GroupOrUngroupSelectedLayers(!event.shiftKey));
        return false;
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
          this.actionModeService.deleteSelections();
        } else {
          this.store.dispatch(new DeleteSelectedModels());
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
        this.animatorService.toggleIsPlaying();
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
        // R.
        this.animatorService.toggleIsRepeating();
        return false;
      }
      if (event.keyCode === 'S'.charCodeAt(0)) {
        // S.
        this.animatorService.toggleIsSlowMotion();
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
}
