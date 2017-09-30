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
  readonly TOOL_MODE_VECTOR = ToolMode.Vector;
  readonly TOOL_MODE_ELLIPSE = ToolMode.Ellipse;
  readonly TOOL_MODE_RECTANGLE = ToolMode.Rectangle;
  readonly TOOL_MODE_ZOOMPAN = ToolMode.ZoomPan;

  toolMode$: Observable<ToolMode>;

  constructor(public readonly ps: PaperService) {}

  ngOnInit() {
    this.toolMode$ = this.ps.store.select(getToolMode);
  }

  onSelectClick() {
    this.ps.setToolMode(ToolMode.Selection);
  }

  onPencilClick() {
    this.ps.setToolMode(ToolMode.Pencil);
  }

  onVectorClick() {
    this.ps.setToolMode(ToolMode.Vector);
  }

  onEllipseClick() {
    this.ps.setToolMode(ToolMode.Ellipse);
  }

  onRectangleClick() {
    this.ps.setToolMode(ToolMode.Rectangle);
  }

  onZoomPanClick() {
    this.ps.setToolMode(ToolMode.ZoomPan);
  }
}
