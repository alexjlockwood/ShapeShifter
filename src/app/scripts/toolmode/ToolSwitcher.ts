import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import { DirectSelectTool } from './DirectSelectTool';
import { PenTool } from './PenTool';
import { RotateTool } from './RotateTool';
import { ScaleTool } from './ScaleTool';
import { SelectTool } from './SelectTool';
import { ToolMode } from './ToolMode';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';
import { ToolWrapper } from './ToolWrapper';
import * as PaperUtil from './util/PaperUtil';
import { ZoomPanTool } from './ZoomPanTool';

export class ToolSwitcher {
  private readonly tools = new Map<ToolMode, ToolWrapper>([
    [ToolMode.Select, new SelectTool()],
    [ToolMode.DirectSelect, new DirectSelectTool()],
    [ToolMode.Pen, new PenTool()],
  ]);
  private activeToolMode: ToolMode;

  constructor() {}

  private get activeTool() {
    return this.tools.get(this.activeToolMode);
  }

  setToolMode(toolMode: ToolMode) {
    if (this.activeToolMode === toolMode) {
      return;
    }
    this.activeToolMode = toolMode;
    this.activeTool.activate();
  }

  // setFillColor(fillColor: string) {
  //   this.toolState.setFillColor(fillColor);

  //   // TODO: can any other types of items be included?
  //   const items = paper.project
  //     .selectedItems
  //     .filter(item => item instanceof paper.PathItem) as paper.PathItem[];
  //   for (const item of items) {
  //     // TODO: only set valid colors on the path items
  //     item.fillColor = fillColor;
  //   }
  // }

  // setStrokeColor(strokeColor: string) {
  //   this.toolState.setStrokeColor(strokeColor);

  //   // TODO: can any other types of items be included?
  //   const items = paper.project
  //     .selectedItems
  //     .filter(item => item instanceof paper.PathItem) as paper.PathItem[];
  //   for (const item of items) {
  //     // TODO: only set valid colors on the path items
  //     item.strokeColor = strokeColor;
  //   }
  // }
}

class ToolStateImpl implements ToolState {
  private mode: ToolMode;
  private selectionBounds: paper.Rectangle;
  private selectionBoundsPath: paper.Path.Rectangle;
  private numSelections = 0;

  // TODO: fetch this directly from the store instead of storing a cached value here?
  private fillColor: string;
  private strokeColor: string;

  getToolMode() {
    return this.mode;
  }

  setToolMode(mode: ToolMode) {
    this.mode = mode;
  }

  getSelectionBounds() {
    return this.selectionBounds;
  }

  getSelectionBoundsPath() {
    return this.selectionBoundsPath;
  }

  getFillColor() {
    return this.fillColor;
  }

  setFillColor(fillColor: string) {
    this.fillColor = fillColor;
  }

  getStrokeColor() {
    return this.strokeColor;
  }

  setStrokeColor(strokeColor: string) {
    this.strokeColor = strokeColor;
  }

  // TODO: figure out what this is used for
  showSelectionBounds() {
    this.numSelections++;
    if (this.selectionBoundsPath) {
      this.selectionBoundsPath.visible = true;
    }
  }

  // TODO: figure out what this is used for
  hideSelectionBounds() {
    this.numSelections = Math.max(0, this.numSelections - 1);
    if (this.selectionBoundsPath && this.numSelections === 0) {
      this.selectionBoundsPath.visible = false;
    }
  }

  updateSelectionBounds() {
    this.clearSelectionBounds();
    this.selectionBounds = ToolsUtil.getSelectionBounds();
    if (!this.selectionBounds) {
      return;
    }
    const rect = new paper.Path.Rectangle(this.selectionBounds);
    rect.strokeColor = 'rgba(0,0,0,0)';
    rect.strokeWidth = 1 / paper.view.zoom;
    rect.selected = true;
    rect.fullySelected = true;
    rect.guide = true;
    rect.visible = this.numSelections > 0;
    this.selectionBoundsPath = rect;
  }

  // TODO: should we set numSelections to 0 here?
  // doing so makes rotate/scale stop working after the first selection
  clearSelectionBounds() {
    this.selectionBounds = undefined;
    if (this.selectionBoundsPath) {
      this.selectionBoundsPath.remove();
      this.selectionBoundsPath = undefined;
    }
  }
}

type FireType = 'switchmode' | 'mousedown' | 'mousemove' | 'mouseup' | 'keydown' | 'keyup';
