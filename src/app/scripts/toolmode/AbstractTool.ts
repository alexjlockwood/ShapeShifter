import { Handler } from 'app/scripts/gesture';
import * as paper from 'paper';

const DOUBLE_CLICK_MIN_TIME = 40;
const DOUBLE_CLICK_TIMEOUT = 300;

export abstract class AbstractTool {
  private readonly tool = new paper.Tool();
  private readonly handler = new Handler();

  /**
   * True when the user is still touching for the second
   * click (down, move, and up events).
   */
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
      deactivate: () => this.onDeactivate(),
    });
  }

  activate() {
    this.tool.activate();
  }

  private mouseDown(event: paper.ToolEvent) {
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
      // This is a first click.
      this.handler.postDelayed(() => {
        if (this.stillDown) {
          // If the user's mouse is still down, do not count it as a click.
          this.deferSingleClick = true;
        } else {
          this.onSingleClickConfirmed(event);
        }
      }, DOUBLE_CLICK_TIMEOUT);
    }
    this.currentDownEvent = event;
    this.stillDown = true;
    this.deferSingleClick = false;
    if (!this.isDoubleClicking) {
      this.onMouseDown(event);
    }
  }

  private mouseDrag(event: paper.ToolEvent) {
    if (!this.isDoubleClicking) {
      this.onMouseDrag(event);
    }
  }

  private mouseMove(event: paper.ToolEvent) {
    if (!this.isDoubleClicking) {
      this.onMouseMove(event);
    }
  }

  private mouseUp(event: paper.ToolEvent) {
    if (!this.isDoubleClicking) {
      this.onMouseUp(event);
      this.onSingleClick(event);
      if (this.deferSingleClick) {
        this.onSingleClickConfirmed(event);
      }
    }
    this.stillDown = false;
    this.previousUpEvent = event;
    this.isDoubleClicking = false;
    this.deferSingleClick = false;
  }

  protected onActivate() {}
  protected onMouseDown(event: paper.ToolEvent) {}
  protected onMouseDrag(event: paper.ToolEvent) {}
  protected onMouseMove(event: paper.ToolEvent) {}
  protected onMouseUp(event: paper.ToolEvent) {}
  protected onSingleClick(event: paper.ToolEvent) {}
  protected onSingleClickConfirmed(event: paper.ToolEvent) {}
  protected onDoubleClick(event: paper.ToolEvent) {}
  protected onDeactivate() {}
}
