import {
  Component, OnInit, Input, ChangeDetectionStrategy
} from '@angular/core';
import { SubPath } from '../scripts/paths';
import {
  StateService, SelectionService, HoverService, HoverType
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
    this.selectionService.toggleSubPath(this.canvasType, this.subIdx).notify();
  }

  onSubPathHoverEvent(isHoveringOverSubPath: boolean) {
    this.isHoveringOverSubPath = isHoveringOverSubPath;
    this.broadcastHoverEvent(isHoveringOverSubPath, HoverType.SubPath);
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
      this.hoverService.resetAndNotify();
    }
    this.isHovering = this.isHoveringOverSubPath;
  }
}
