import {
  Component, OnInit, Input, ChangeDetectionStrategy
} from '@angular/core';
import { SubPath, Path } from '../scripts/paths';
import {
  StateService, SelectionService, HoverService, HoverType
} from '../services';
import { CanvasType } from '../CanvasType';

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

  isHovering = false;
  private isHoveringOverDeleteSubPath = false;
  private isHoveringOverSubPath = false;
  private subPathText_ = '';

  constructor(
    private readonly stateService: StateService,
    private readonly hoverService: HoverService,
    private readonly selectionService: SelectionService,
  ) { }

  ngOnInit() {
    this.subPathText_ =
      `Subpath #${this.subIdx + 1}${this.canvasType === CanvasType.Start ? 'a' : 'b'}`;
  }

  get subPathText() {
    return this.subPath ? this.subPathText_ : '';
  }

  onSubPathClick(event: MouseEvent) {
    if (!this.subPath) {
      return;
    }
    this.selectionService.toggleSubPath(this.canvasType, this.subIdx).notify();
  }

  onUnsplitButtonClick(event: MouseEvent) {
    if (!this.subPath) {
      return;
    }
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    if (fromPathLayer.isFilled()) {
      this.replacePath(fromPathLayer.pathData.mutate()
        .deleteFilledSubPath(this.subIdx)
        .build(),
        event);
    } else if (fromPathLayer.isStroked()) {
      this.replacePath(fromPathLayer.pathData.mutate()
        .deleteStrokedSubPath(this.subIdx)
        .build(),
        event);
    }
  }

  private clearSelectionsAndHovers() {
    this.hoverService.resetAndNotify();
    this.selectionService.resetAndNotify();
  }

  private replacePath(path: Path, event: MouseEvent) {
    this.stateService.updateActivePath(this.canvasType, path);

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }

  private getPath() {
    const pathLayer = this.stateService.getActivePathLayer(this.canvasType);
    if (!pathLayer) {
      return undefined;
    }
    return pathLayer.pathData;
  }

  isUnsplittable() {
    const path = this.getPath();
    return path && this.subPath && this.subPath.isUnsplittable();
  }

  onSubPathHoverEvent(isHoveringOverSubPath: boolean) {
    if (!this.subPath) {
      return;
    }
    this.isHoveringOverSubPath = isHoveringOverSubPath;
    this.broadcastHoverEvent(isHoveringOverSubPath, HoverType.SubPath);
  }

  onDeleteSubPathHoverEvent(isHoveringOverDeleteSubPath: boolean) {
    if (!this.subPath) {
      return;
    }
    this.isHoveringOverDeleteSubPath = isHoveringOverDeleteSubPath;
    this.broadcastHoverEvent(isHoveringOverDeleteSubPath, HoverType.SubPath);
  }

  private broadcastHoverEvent(isHovering: boolean, type: HoverType) {
    const subIdx = this.subIdx;
    if (isHovering) {
      this.hoverService.setHoverAndNotify({
        type,
        subIdx,
        source: this.canvasType,
      });
    } else if (type !== HoverType.Point && this.isHoveringOverSubPath) {
      this.hoverService.setHoverAndNotify({
        type: HoverType.Point,
        subIdx,
        source: this.canvasType,
      });
    } else {
      this.hoverService.resetAndNotify();
    }
    this.isHovering = this.isHoveringOverSubPath && !this.isHoveringOverDeleteSubPath;
  }
}
