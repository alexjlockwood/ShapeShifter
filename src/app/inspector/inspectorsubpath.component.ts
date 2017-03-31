import {
  Component, OnInit, Input, ChangeDetectionStrategy
} from '@angular/core';
import { Path, SubPath } from '../scripts/paths';
import { StateService } from '../services';
import { CanvasType } from '../CanvasType';

// TODO: these need to be canvas-mode-aware
// TODO: fix the way we handle collapsing sub paths. right now things are kinda hacky...
@Component({
  selector: 'app-inspectorsubpath',
  templateUrl: './inspectorsubpath.component.html',
  styleUrls: ['./inspectoritem.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectorSubPathComponent implements OnInit {
  @Input() canvasType: CanvasType;
  @Input() subIdx: number;
  @Input() subPath: SubPath;
  private subPathText_ = '';

  constructor(private readonly stateService: StateService) { }

  ngOnInit() {
    this.subPathText_ = `Subpath #${this.subIdx + 1}${this.canvasType === CanvasType.Start ? 'a' : 'b'}`;
  }

  get subPathText() {
    return this.subPath ? this.subPathText_ : '';
  }

  onMoveSubPathUpClick(event: MouseEvent) {
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.replacePath(fromPathLayer.pathData.mutate()
      .moveSubPath(this.subIdx, this.subIdx - 1)
      .build(),
      event);
  }

  onMoveSubPathDownClick(event: MouseEvent) {
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.replacePath(fromPathLayer.pathData.mutate()
      .moveSubPath(this.subIdx, this.subIdx + 1)
      .build(),
      event);
  }

  onUnsplitButtonClick(event: MouseEvent) {
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
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
}
