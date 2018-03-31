import { Component, OnInit } from '@angular/core';
import { ToolMode } from 'app/model/paper';
import { PaperService } from 'app/services';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-toolpanel',
  templateUrl: './toolpanel.component.html',
  styleUrls: ['./toolpanel.component.scss'],
})
export class ToolPanelComponent implements OnInit {
  readonly TOOL_MODE_PENCIL = ToolMode.Pencil;
  readonly TOOL_MODE_ELLIPSE = ToolMode.Ellipse;
  readonly TOOL_MODE_RECTANGLE = ToolMode.Rectangle;
  readonly TOOL_MODE_ZOOMPAN = ToolMode.ZoomPan;

  // TODO: only enable edit path/rotate/transform in selection mode?
  model$: Observable<ToolPanelModel>;

  constructor(private readonly ps: PaperService) {}

  ngOnInit() {
    this.model$ = this.ps.observeToolPanelState();
  }

  onSelectionClick() {
    this.ps.setToolMode(ToolMode.Selection);
    this.ps.setFocusedPathInfo(undefined);
    event.stopPropagation();
  }

  onRotateItemsClick() {
    this.ps.enterRotateItemsMode();
    event.stopPropagation();
  }

  onTransformPathsClick() {
    this.ps.enterTransformPathsMode();
    event.stopPropagation();
  }

  onPencilClick() {
    this.ps.setToolMode(ToolMode.Pencil);
    event.stopPropagation();
  }

  onFocusPathClick() {
    this.ps.enterFocusedPathMode();
    event.stopPropagation();
  }

  onEllipseClick() {
    this.ps.enterCreateEllipseMode();
    event.stopPropagation();
  }

  onRectangleClick() {
    this.ps.enterCreateRectangleMode();
    event.stopPropagation();
  }

  onZoomPanClick() {
    this.ps.setToolMode(ToolMode.ZoomPan);
    event.stopPropagation();
  }
}

interface ToolPanelModel {
  readonly toolMode: ToolMode;
  readonly isSelectionChecked: boolean;
  readonly isFocusPathChecked: boolean;
  readonly isRotateItemsEnabled: boolean;
  readonly isRotateItemsChecked: boolean;
  readonly isTransformPathsEnabled: boolean;
  readonly isTransformPathsChecked: boolean;
}
