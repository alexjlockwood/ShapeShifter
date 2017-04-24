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

  isSelectedObservable: Observable<boolean>;
  shouldShowPointerCursorObservable: Observable<boolean>;

  private isHoveringOverCommand = false;
  private isHoveringOverUnsplit = false;

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
    this.shouldShowPointerCursorObservable =
      this.appModeService.asObservable()
        .map(appMode => appMode === AppMode.Selection);
  }

  isHovering() {
    return this.appModeService.isSelectionMode()
      && this.isHoveringOverCommand
      && !this.isHoveringOverUnsplit;
  }

  shouldShowDeletePoint() {
    return this.command.isSplitPoint();
  }

  shouldDisableDeletePoint() {
    return !this.appModeService.isSelectionMode();
  }

  onPointClick(event: MouseEvent) {
    if (!this.appModeService.isSelectionMode()) {
      return;
    }
    const selections = this.selectionService.getPointSelections();
    const appendToList = event.shiftKey || event.metaKey;
    if (selections.length && selections[0].source !== this.canvasType && appendToList) {
      // If the user is attempting to select something in a different pane in the
      // middle of a multi-select, do nothing.
      return;
    }
    this.selectionService.togglePoint(
      this.canvasType, this.subIdx, this.cmdIdx, appendToList).notify();
  }

  onDeletePointClick(event: MouseEvent) {
    if (!this.appModeService.isSelectionMode()) {
      return;
    }
    const fromPathLayer = this.stateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    this.stateService.updateActivePath(
      this.canvasType, fromPathLayer.pathData.mutate()
        .unsplitCommand(this.subIdx, this.cmdIdx)
        .build());

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }

  onPointHover(isHovering: boolean) {
    this.isHoveringOverCommand = isHovering;
    if (!this.appModeService.isSelectionMode()) {
      return;
    }
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
  }

  onDeletePointHover(isHovering: boolean) {
    this.isHoveringOverUnsplit = isHovering;
  }

  private clearSelectionsAndHovers() {
    this.hoverService.resetAndNotify();
    this.selectionService.resetAndNotify();
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
