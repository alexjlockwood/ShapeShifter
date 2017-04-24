import * as _ from 'lodash';
import {
  Component, OnInit, Input, Pipe, PipeTransform, ChangeDetectionStrategy
} from '@angular/core';
import { Command } from '../scripts/paths';
import {
  HoverService,
  HoverType,
  StateService,
  SelectionService,
  SelectionType,
  Selection,
  AppModeService,
  AppMode,
} from '../services';
import { Observable } from 'rxjs/Observable';
import { CanvasType } from '../CanvasType';

@Component({
  selector: 'app-commandinspector',
  templateUrl: './commandinspector.component.html',
  styleUrls: ['./inspectoritem.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandInspectorComponent implements OnInit {
  @Input() canvasType: CanvasType;
  @Input() subIdx: number;
  @Input() cmdIdx: number;
  @Input() command: Command;

  // TODO: hide pointer cursor when not in selection mode
  // TODO: pointer cursor in canvas doesnt show up on top of stroked path
  isSelectionModeObservable: Observable<boolean>;
  isSelectedObservable: Observable<boolean>;
  isHovering = false;

  constructor(
    private readonly stateService: StateService,
    private readonly hoverService: HoverService,
    private readonly selectionService: SelectionService,
    private readonly appModeService: AppModeService,
  ) { }

  ngOnInit() {
    this.isSelectedObservable =
      this.selectionService.asObservable()
        .map(selections => {
          const activePathId = this.stateService.getActivePathId(this.canvasType);
          return activePathId && _.some(selections, {
            type: SelectionType.Point,
            source: this.canvasType,
            subIdx: this.subIdx,
            cmdIdx: this.cmdIdx,
          } as Selection);
        });
  }

  onCommandClick(event: MouseEvent) {
    if (this.appModeService.getAppMode() !== AppMode.Selection) {
      return;
    }
    const selections =
      this.selectionService.getSelections().filter(s => s.type === SelectionType.Point);
    const appendToList = event.shiftKey || event.metaKey;
    if (selections.length && selections[0].source !== this.canvasType && appendToList) {
      // If the user is attempting to select something in a different pane in the
      // middle of a multi-select, do nothing.
      return;
    }
    this.selectionService.togglePoint(this.canvasType, this.subIdx, this.cmdIdx, appendToList).notify();
  }

  private getPath() {
    const pathLayer = this.stateService.getActivePathLayer(this.canvasType);
    if (!pathLayer) {
      return undefined;
    }
    return pathLayer.pathData;
  }

  isReversible() {
    const path = this.getPath();
    return this.cmdIdx === 0 && path && path.getSubPaths()[this.subIdx].getCommands().length > 1;
  }

  isShiftable() {
    const path = this.getPath();
    return this.cmdIdx === 0 && path && path.getSubPaths()[this.subIdx].isClosed();
  }

  isSplittable() {
    return this.command.getSvgChar() !== 'M';
  }

  isUnsplittable() {
    return this.command.isSplitPoint();
  }

  onCommandHoverEvent(isHovering: boolean) {
    if (isHovering) {
      this.hoverService.setHoverAndNotify({
        type: HoverType.Point,
        subIdx: this.subIdx,
        cmdIdx: this.cmdIdx,
        source: this.canvasType,
      });
    } else {
      this.hoverService.resetAndNotify();
    }
    this.isHovering = isHovering;
  }
}

@Pipe({ name: 'toSvgText' })
export class SvgCommandPipe implements PipeTransform {
  transform(c: Command): string {
    if (c.getSvgChar() === 'Z') {
      return `${c.getSvgChar()}`;
    } else {
      const p = _.last(c.getPoints());
      const x = _.round(p.x, 2);
      const y = _.round(p.y, 2);
      return `${c.getSvgChar()} ${x}, ${y}`;
    }
  }
}
