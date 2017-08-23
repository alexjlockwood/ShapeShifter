import * as paper from 'paper';

export abstract class ToolWrapper {
  private readonly tool = new paper.Tool();

  constructor() {
    this.tool.on({
      mousedown: (event: paper.ToolEvent) => this.onMouseDown(event),
      mousedrag: (event: paper.ToolEvent) => this.onMouseDrag(event),
      mousemove: (event: paper.ToolEvent) => this.onMouseMove(event),
      mouseup: (event: paper.ToolEvent) => this.onMouseUp(event),
    });
  }

  activate() {
    this.tool.activate();
  }

  abstract onActivate(): void;
  abstract onMouseDown(event: paper.ToolEvent): void;
  abstract onMouseDrag(event: paper.ToolEvent): void;
  abstract onMouseMove(event: paper.ToolEvent): void;
  abstract onMouseUp(event: paper.ToolEvent): void;
  abstract onDeactivate(): void;
}
