import { Component, OnInit } from '@angular/core';
import { ToolMode } from 'app/model/paper';
import { PaperService } from 'app/services';
import { getToolMode } from 'app/store/paper/selectors';
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

  toolMode$: Observable<ToolMode>;

  // TODO: deal with invalid fill/stroke colors
  constructor(public readonly paperService: PaperService) {}

  ngOnInit() {
    this.toolMode$ = this.paperService.store.select(getToolMode);
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
    return '#000000';
  }

  set fillColor(color: string) {}

  get strokeColor() {
    return '#000000';
  }

  set strokeColor(color: string) {}
}
