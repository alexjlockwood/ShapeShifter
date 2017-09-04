import { Component, OnInit } from '@angular/core';
import { ToolMode } from 'app/model/paper';
import { ColorUtil } from 'app/scripts/common';
import { PaperService } from 'app/services';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-toolpanel',
  templateUrl: './toolpanel.component.html',
  styleUrls: ['./toolpanel.component.scss'],
})
export class ToolPanelComponent implements OnInit {
  readonly TOOL_MODE_SELECT = ToolMode.Selection;
  readonly TOOL_MODE_PENCIL = ToolMode.Pencil;
  readonly TOOL_MODE_PEN = ToolMode.Pen;
  readonly TOOL_MODE_CIRCLE = ToolMode.Circle;
  readonly TOOL_MODE_RECTANGLE = ToolMode.Rectangle;
  readonly TOOL_MODE_ZOOMPAN = ToolMode.ZoomPan;

  private toolMode$: Observable<ToolMode>;

  // TODO: deal with invalid fill/stroke colors
  constructor(public readonly paperService: PaperService) {}

  ngOnInit() {
    this.toolMode$ = this.paperService.getToolModeObservable();
  }

  onSelectClick() {
    this.paperService.setToolMode(ToolMode.Selection);
  }

  onPencilClick() {
    this.paperService.setToolMode(ToolMode.Pencil);
  }

  onPenClick() {
    this.paperService.setToolMode(ToolMode.Pen);
  }

  onCircleClick() {
    this.paperService.setToolMode(ToolMode.Circle);
  }

  onRectangleClick() {
    this.paperService.setToolMode(ToolMode.Rectangle);
  }

  onZoomPanClick() {
    this.paperService.setToolMode(ToolMode.ZoomPan);
  }

  get fillColor() {
    return this.paperService.getFillColor();
  }

  set fillColor(color: string) {
    this.paperService.setFillColor(color);
  }

  get strokeColor() {
    return this.paperService.getStrokeColor();
  }

  set strokeColor(color: string) {
    this.paperService.setStrokeColor(color);
  }
}
