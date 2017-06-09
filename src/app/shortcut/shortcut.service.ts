import { ActionModeService } from '../actionmode/actionmode.service';
import { AnimatorService } from '../animator';
import {
  State,
  Store,
} from '../store';
import { DeleteSelectedModels } from '../store/common/actions';
import { Injectable } from '@angular/core';
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
        // undo/redo (Z key)
        event.shiftKey
          ? this.store.dispatch(ActionCreators.redo())
          : this.store.dispatch(ActionCreators.undo());
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
      if (event.keyCode === 82 && !event.ctrlKey && !event.metaKey) {
        // R.
        this.animatorService.toggleIsRepeating();
        return false;
      }
      if (event.keyCode === 83) {
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
