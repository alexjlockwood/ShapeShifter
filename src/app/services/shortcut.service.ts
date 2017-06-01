import { AnimatorService } from '../animator';
import { DeleteSelectedModels, State, Store } from '../store';
import { Injectable } from '@angular/core';
import * as $ from 'jquery';

@Injectable()
export class ShortcutService {

  constructor(
    private readonly store: Store<State>,
    private readonly animatorService: AnimatorService,
  ) { }

  init() {
    $(window).on('keydown', event => {
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
        this.store.dispatch(new DeleteSelectedModels());
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
    $(window).unbind('keydown');
  }
}
