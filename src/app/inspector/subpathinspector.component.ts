import {
  Component, OnInit, Input, ChangeDetectionStrategy
} from '@angular/core';
import { SubPath } from '../scripts/paths';
import {
  StateService,
  SelectionService,
  HoverService, HoverType,
  AppModeService, AppMode
} from '../services';
import { CanvasType } from '../CanvasType';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-subpathinspector',
  templateUrl: './subpathinspector.component.html',
  styleUrls: ['./inspectoritem.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubpathInspectorComponent implements OnInit {
  readonly START_CANVAS = CanvasType.Start;
  readonly END_CANVAS = CanvasType.End;

  @Input() canvasType: CanvasType;
  @Input() subIdx: number;
  @Input() subPath: SubPath;

  shouldShowPointerCursorObservable: Observable<boolean>;
  private isHoveringOverSubPath = false;
  private isHoveringOverDeleteSubPath = false;

  constructor(
    private readonly stateService: StateService,
    private readonly hoverService: HoverService,
    private readonly selectionService: SelectionService,
    private readonly appModeService: AppModeService,
  ) { }

  ngOnInit() {
    this.shouldShowPointerCursorObservable =
      this.appModeService.asObservable()
        .map(appMode => this.subPath && appMode === AppMode.Selection);
  }

  getSubPathText() {
    if (!this.subPath) {
      return '';
    }
    return `Subpath #${this.subIdx + 1}${this.canvasType === CanvasType.Start ? 'a' : 'b'}`;
  }

  isHovering() {
    return this.subPath
      && this.appModeService.isSelectionMode()
      && this.isHoveringOverSubPath
      && !this.isHoveringOverDeleteSubPath;
  }

  shouldShowDeleteSubPath() {
    return this.subPath && this.subPath.isUnsplittable();
  }

  shouldDisableDeleteSubPath() {
    return !this.appModeService.isSelectionMode();
  }

  onSubPathClick(event: MouseEvent) {
    if (!this.subPath || !this.appModeService.isSelectionMode()) {
      return;
    }
    this.selectionService.toggleSubPath(this.canvasType, this.subIdx).notify();
  }

  onDeleteSubPathClick(event: MouseEvent) {
    if (!this.subPath || !this.appModeService.isSelectionMode()) {
      return;
    }
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    if (fromPathLayer.isFilled()) {
      this.stateService.updateActivePath(
        this.canvasType,
        fromPathLayer.pathData.mutate()
          .deleteFilledSubPath(this.subIdx)
          .build());
    } else if (fromPathLayer.isStroked()) {
      this.stateService.updateActivePath(
        this.canvasType,
        fromPathLayer.pathData.mutate()
          .deleteStrokedSubPath(this.subIdx)
          .build());
    }

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }

  onSubPathHover(isHovering: boolean) {
    if (!this.subPath || !this.appModeService.isSelectionMode()) {
      return;
    }
    this.isHoveringOverSubPath = isHovering;
    if (isHovering || this.isHoveringOverSubPath) {
      this.hoverService.setHoverAndNotify({
        type: HoverType.SubPath,
        subIdx: this.subIdx,
        source: this.canvasType,
      });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  onDeleteSubPathHover(isHovering: boolean) {
    if (!this.subPath || !this.appModeService.isSelectionMode()) {
      return;
    }
    this.isHoveringOverDeleteSubPath = isHovering;
    if (isHovering || this.isHoveringOverSubPath) {
      this.hoverService.setHoverAndNotify({
        type: HoverType.SubPath,
        subIdx: this.subIdx,
        source: this.canvasType,
      });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  private clearSelectionsAndHovers() {
    this.hoverService.resetAndNotify();
    this.selectionService.resetAndNotify();
  }
}
