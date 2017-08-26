import * as paper from 'paper';

import { Handler } from './util';

const DOUBLE_CLICK_MIN_TIME = 40;
const DOUBLE_CLICK_TIMEOUT = 300;

/**
 * The base class for all tools.
 */
export abstract class AbstractTool {
  private readonly tool = new paper.Tool();
  private readonly handler = new Handler();
  private isDoubleClicking = false;
  private deferSingleClick = false;
  private stillDown = false;
  private currentDownEvent: paper.ToolEvent;
  private previousUpEvent: paper.ToolEvent;

  constructor() {
    this.tool.on({
      activate: () => this.onActivate(),
      mousedown: (event: paper.ToolEvent) => this.mouseDown(event),
      mousedrag: (event: paper.ToolEvent) => this.mouseDrag(event),
      mousemove: (event: paper.ToolEvent) => this.mouseMove(event),
      mouseup: (event: paper.ToolEvent) => this.mouseUp(event),
      keydown: (event: paper.KeyEvent) => this.keyDown(event),
      keyup: (event: paper.KeyEvent) => this.keyUp(event),
      deactivate: () => this.onDeactivate(),
    });
  }

  activate() {
    // Note that activating a paper.js tool automatically deactivates
    // any currently active tools that may exist.
    this.tool.activate();
  }

  private mouseDown(event: paper.ToolEvent) {
    this.checkForClicks(event);
    this.onMouseDown(event);
  }

  private checkForClicks(event: paper.ToolEvent) {
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

  private mouseDrag(event: paper.ToolEvent) {
    this.onMouseDrag(event);
  }

  private mouseMove(event: paper.ToolEvent) {
    this.onMouseMove(event);
  }

  private mouseUp(event: paper.ToolEvent) {
    this.onSingleClick(event);
    if (this.deferSingleClick) {
      this.onSingleClickConfirmed(event);
    }
    this.onMouseUp(event);
    this.stillDown = false;
    this.previousUpEvent = event;
    this.isDoubleClicking = false;
    this.deferSingleClick = false;
  }

  private keyDown(event: paper.KeyEvent) {
    console.log(event);
    this.onKeyDown(event);
  }

  private keyUp(event: paper.KeyEvent) {
    console.log(event);
    this.onKeyUp(event);
  }

  protected onActivate() {}
  protected onMouseDown(event: paper.ToolEvent) {}
  protected onMouseDrag(event: paper.ToolEvent) {}
  protected onMouseMove(event: paper.ToolEvent) {}
  protected onMouseUp(event: paper.ToolEvent) {}
  protected onSingleClick(event: paper.ToolEvent) {}
  protected onSingleClickConfirmed(event: paper.ToolEvent) {}
  protected onDoubleClick(event: paper.ToolEvent) {}
  protected onKeyDown(event: paper.KeyEvent) {}
  protected onKeyUp(event: paper.KeyEvent) {}
  protected onDeactivate() {}

  /**
   * Returns true iff the current gesture began with a down event
   * that triggered a double click event.
   */
  protected isDoubleClickEvent() {
    return this.isDoubleClicking;
  }
}
