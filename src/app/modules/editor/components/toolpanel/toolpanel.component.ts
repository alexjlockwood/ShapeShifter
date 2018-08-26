import { Component, OnInit } from '@angular/core';
import { ToolMode } from 'app/modules/editor/model/paper';
import { PaperService, ShortcutService } from 'app/modules/editor/services';
import { Observable } from 'rxjs';

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

  // TODO: only enable edit path/rotate/transform in default mode?
  model$: Observable<ToolPanelModel>;

  constructor(private readonly ps: PaperService) {}

  ngOnInit() {
    this.model$ = this.ps.observeToolPanelState();
  }

  onDefaultClick(event: Event) {
    this.ps.enterDefaultMode();
    event.stopPropagation();
  }

  onRotateItemsClick(event: Event) {
    this.ps.enterRotateItemsMode();
    event.stopPropagation();
  }

  onTransformPathsClick(event: Event) {
    this.ps.enterTransformPathsMode();
    event.stopPropagation();
  }

  onPencilClick(event: Event) {
    this.ps.enterPencilMode();
    event.stopPropagation();
  }

  onEditPathClick(event: Event) {
    this.ps.enterEditPathMode();
    event.stopPropagation();
  }

  onEllipseClick(event: Event) {
    this.ps.enterCreateEllipseMode();
    event.stopPropagation();
  }

  onRectangleClick(event: Event) {
    this.ps.enterCreateRectangleMode();
    event.stopPropagation();
  }

  onZoomPanClick(event: Event) {
    this.ps.setToolMode(ToolMode.ZoomPan);
    event.stopPropagation();
  }

  isMac() {
    return ShortcutService.isMac();
  }
}

interface ToolPanelModel {
  readonly toolMode: ToolMode;
  readonly isDefaultChecked: boolean;
  readonly isEditPathChecked: boolean;
  readonly isRotateItemsEnabled: boolean;
  readonly isRotateItemsChecked: boolean;
  readonly isTransformPathsEnabled: boolean;
  readonly isTransformPathsChecked: boolean;
}
