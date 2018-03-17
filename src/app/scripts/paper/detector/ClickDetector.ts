import * as paper from 'paper';

import { Handler } from './Handler';

const DOUBLE_CLICK_MIN_TIME = 40;
const DOUBLE_CLICK_TIMEOUT = 300;

/**
 * Helper class for detecting single/double click events.
 */
export class ClickDetector {
  private readonly handler = new Handler();
  private currentDownEvent: paper.ToolEvent;
  private previousUpEvent: paper.ToolEvent;
  private isDoubleClicking = false;
  private deferSingleClick = false;
  private stillDown = false;

  onToolEvent(event: paper.ToolEvent) {
    if (event.type === 'mousedown') {
      this.processMouseDown(event);
    } else if (event.type === 'mouseup') {
      this.processMouseUp(event);
    }
  }

  private processMouseDown(event: paper.ToolEvent) {
    const hadClickMessage = this.handler.hasPendingMessages();
    if (hadClickMessage) {
      this.handler.removePendingMessages();
    }
    const isDoubleClickFn = (firstUp: paper.ToolEvent, secondDown: paper.ToolEvent) => {
      const deltaTime = secondDown.timeStamp - firstUp.timeStamp;
      return DOUBLE_CLICK_MIN_TIME <= deltaTime && deltaTime <= DOUBLE_CLICK_TIMEOUT;
    };
    if (
      this.currentDownEvent &&
      this.previousUpEvent &&
      hadClickMessage &&
      isDoubleClickFn(this.previousUpEvent, event)
    ) {
      // This is a second tap, so give a callback with the
      // first click of the double click.
      this.isDoubleClicking = true;
      this.onDoubleClick(this.currentDownEvent);
    } else {
      // This is the first click.
      this.handler.postDelayed(() => {
        if (this.stillDown) {
          // If the user's mouse is still down, do not dispatch the click
          // event until the next mouse up event.
          this.deferSingleClick = true;
        } else {
          // At this point we are certain that a second click is not coming,
          // so dispatch the single click event.
          this.onSingleClickConfirmed(event);
        }
      }, DOUBLE_CLICK_TIMEOUT);
    }
    this.currentDownEvent = event;
    this.stillDown = true;
    this.deferSingleClick = false;
  }

  private processMouseUp(event: paper.ToolEvent) {
    this.onSingleClick(event);
    if (this.deferSingleClick) {
      this.onSingleClickConfirmed(event);
    }
    this.stillDown = false;
    this.previousUpEvent = event;
    this.isDoubleClicking = false;
    this.deferSingleClick = false;
  }

  isDoubleClick() {
    return this.isDoubleClicking;
  }

  protected onSingleClick(event: paper.ToolEvent) {}

  protected onSingleClickConfirmed(event: paper.ToolEvent) {}

  protected onDoubleClick(event: paper.ToolEvent) {}
}
