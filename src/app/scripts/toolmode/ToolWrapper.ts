import * as paper from 'paper';

export class ToolWrapper {
  protected readonly tool = new paper.Tool();

  activate() {
    this.tool.activate();
  }
}
