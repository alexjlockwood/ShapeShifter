import {
  Component, OnInit, Input, ChangeDetectionStrategy
} from '@angular/core';
import { Path, SubPath } from '../scripts/paths';
import {
  StateService, SelectionService, SelectionType, HoverService, HoverType
} from '../services';
import { CanvasType } from '../CanvasType';

// TODO: these need to be canvas-mode-aware
@Component({
  selector: 'app-subpathinspector',
  templateUrl: './subpathinspector.component.html',
  styleUrls: ['./subpathinspector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubpathInspectorComponent implements OnInit {
  START_CANVAS = CanvasType.Start;
  END_CANVAS = CanvasType.End;

  @Input() canvasType: CanvasType;
  @Input() subIdx: number;
  @Input() subPath: SubPath;
  isHovering = false;
  private isHoveringOverDeleteSubPath = false;
  private isHoveringOverSubPath = false;
  private isHoveringOverMoveSubPathUp = false;
  private isHoveringOverMoveSubPathDown = false;
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
    this.selectionService.toggleSubPath(this.canvasType, this.subIdx);
  }

  onMoveSubPathUpClick(event: MouseEvent) {
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    this.replacePath(fromPathLayer.pathData.mutate()
      .moveSubPath(this.subIdx, this.subIdx - 1)
      .build(),
      event);
  }

  onMoveSubPathDownClick(event: MouseEvent) {
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    this.replacePath(fromPathLayer.pathData.mutate()
      .moveSubPath(this.subIdx, this.subIdx + 1)
      .build(),
      event);
  }

  onUnsplitButtonClick(event: MouseEvent) {
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    if (fromPathLayer.isFilled()) {
      this.replacePath(fromPathLayer.pathData.mutate()
        .unsplitFilledSubPath(this.subIdx)
        .build(),
        event);
    } else if (fromPathLayer.isStroked()) {
      this.replacePath(fromPathLayer.pathData.mutate()
        .unsplitStrokedSubPath(this.subIdx)
        .build(),
        event);
    }
  }

  private clearSelectionsAndHovers() {
    this.hoverService.reset();
    this.selectionService.reset();
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

  canSubPathBeMovedUp() {
    const path = this.getPath();
    return path && this.subPath && this.subIdx !== 0;
  }

  canSubPathBeMovedDown() {
    const path = this.getPath();
    return path && this.subPath && this.subIdx !== path.getSubPaths().filter(s => !s.isCollapsing()).length - 1;
  }

  onSubPathHoverEvent(isHoveringOverSubPath: boolean) {
    this.isHoveringOverSubPath = isHoveringOverSubPath;
    this.broadcastHoverEvent(isHoveringOverSubPath, HoverType.SubPath);
  }

  onDeleteSubPathHoverEvent(isHoveringOverDeleteSubPath: boolean) {
    this.isHoveringOverDeleteSubPath = isHoveringOverDeleteSubPath;
    this.broadcastHoverEvent(isHoveringOverDeleteSubPath, HoverType.SubPath);
  }

  onMoveSubPathUpHoverEvent(isHoveringOverMoveSubPathUp: boolean) {
    this.isHoveringOverMoveSubPathUp = isHoveringOverMoveSubPathUp;
    this.broadcastHoverEvent(isHoveringOverMoveSubPathUp, HoverType.SubPath);
  }

  onMoveSubPathDownHoverEvent(isHoveringOverMoveSubPathDown: boolean) {
    this.isHoveringOverMoveSubPathDown = isHoveringOverMoveSubPathDown;
    this.broadcastHoverEvent(isHoveringOverMoveSubPathDown, HoverType.Reverse);
  }

  private broadcastHoverEvent(isHovering: boolean, type: HoverType) {
    const subIdx = this.subIdx;
    if (isHovering) {
      this.hoverService.setHover({
        type,
        subIdx,
        source: this.canvasType,
      });
    } else if (type !== HoverType.Point && this.isHoveringOverSubPath) {
      this.hoverService.setHover({
        type: HoverType.Point,
        subIdx,
        source: this.canvasType,
      });
    } else {
      this.hoverService.reset();
    }
    this.isHovering =
      this.isHoveringOverSubPath
      && !this.isHoveringOverDeleteSubPath
      && !this.isHoveringOverMoveSubPathUp
      && !this.isHoveringOverMoveSubPathDown;
  }
}
