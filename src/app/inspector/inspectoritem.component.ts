import * as _ from 'lodash';
import {
  Component, OnInit, Input, OnDestroy, Pipe, PipeTransform, ChangeDetectionStrategy
} from '@angular/core';
import { Path, Command } from '../scripts/commands';
import { LayerStateService } from '../services/layerstate.service';
import { SelectionStateService, Selection } from '../services/selectionstate.service';
import { HoverStateService, Type as HoverType } from '../services/hoverstate.service';
import { Subscription } from 'rxjs/Subscription';
import { CanvasType } from '../CanvasType';

@Component({
  selector: 'app-inspectoritem',
  templateUrl: './inspectoritem.component.html',
  styleUrls: ['./inspectoritem.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectorItemComponent implements OnInit, OnDestroy {
  @Input() canvasType: CanvasType;
  @Input() subIdx: number;
  @Input() cmdIdx: number;
  @Input() command: Command;

  isSelected = false;
  isHovering = false;
  private isHoveringOverCommand = false;
  private isHoveringOverSplit = false;
  private isHoveringOverUnsplit = false;
  private isHoveringOverReverse = false;
  private isHoveringOverShiftBack = false;
  private isHoveringOverShiftForward = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private hoverStateService: HoverStateService,
    private selectionStateService: SelectionStateService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.selectionStateService.getSelectionsObservable().subscribe(
        (selections: Selection[]) => {
          const activePathId = this.layerStateService.getActivePathId(this.canvasType);
          this.isSelected = activePathId && _.some(selections, {
            source: this.canvasType,
            commandId: {
              pathId: activePathId,
              subIdx: this.subIdx,
              cmdIdx: this.cmdIdx,
            }
          });
        }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  onCommandClick(event: MouseEvent) {
    const selections = this.selectionStateService.getSelections();
    const appendToList = event.shiftKey || event.metaKey;
    if (selections.length && selections[0].source !== this.canvasType && appendToList) {
      // If the user is attempting to select something in a different pane in the
      // middle of a multi-select, do nothing.
      return;
    }

    // Selecting the last 'Z' command doesn't seem to work...
    this.selectionStateService.toggle({
      source: this.canvasType,
      commandId: {
        pathId: this.layerStateService.getActivePathId(this.canvasType),
        subIdx: this.subIdx,
        cmdIdx: this.cmdIdx,
      }
    }, appendToList);
  }

  onReverseClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.replacePath(fromPathLayer.pathData.reverse(this.subIdx), event);
  }

  onShiftBackClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.replacePath(fromPathLayer.pathData.shiftBack(this.subIdx), event);
  }

  onShiftForwardClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.replacePath(fromPathLayer.pathData.shiftForward(this.subIdx), event);
  }

  onSplitButtonClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    this.replacePath(
      fromPathLayer.pathData.splitInHalf(this.subIdx, this.cmdIdx), event);
  }

  onUnsplitButtonClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.clearSelectionsAndHovers();
    this.replacePath(
      fromPathLayer.pathData.unsplit(this.subIdx, this.cmdIdx), event);
  }

  private clearSelectionsAndHovers() {
    this.hoverStateService.reset();
    this.selectionStateService.reset();
  }

  private replacePath(path: Path, event: MouseEvent) {
    this.layerStateService.updateActivePath(this.canvasType, path, this.subIdx);

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }

  private getPath() {
    const pathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
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
    return this.command.svgChar !== 'M';
  }

  isUnsplittable() {
    return this.command.isSplit;
  }

  onCommandHoverEvent(isHoveringOverCommand: boolean) {
    this.isHoveringOverCommand = isHoveringOverCommand;
    this.broadcastHoverEvent(isHoveringOverCommand, HoverType.Command);
  }

  onSplitHoverEvent(isHoveringOverSplit: boolean) {
    this.isHoveringOverSplit = isHoveringOverSplit;
    this.broadcastHoverEvent(isHoveringOverSplit, HoverType.Split);
  }

  onUnsplitHoverEvent(isHoveringOverUnsplit: boolean) {
    this.isHoveringOverUnsplit = isHoveringOverUnsplit;
    this.broadcastHoverEvent(isHoveringOverUnsplit, HoverType.Unsplit);
  }

  onReverseHoverEvent(isHoveringOverReverse: boolean) {
    this.isHoveringOverReverse = isHoveringOverReverse;
    this.broadcastHoverEvent(isHoveringOverReverse, HoverType.Reverse);
  }

  onShiftBackHoverEvent(isHoveringOverShiftBack: boolean) {
    this.isHoveringOverShiftBack = isHoveringOverShiftBack;
    this.broadcastHoverEvent(isHoveringOverShiftBack, HoverType.ShiftBack);
  }

  onShiftForwardHoverEvent(isHoveringOverShiftForward: boolean) {
    this.isHoveringOverShiftForward = isHoveringOverShiftForward;
    this.broadcastHoverEvent(isHoveringOverShiftForward, HoverType.ShiftForward);
  }

  private broadcastHoverEvent(isHovering: boolean, hoverType: HoverType) {
    const pathId = this.layerStateService.getActivePathId(this.canvasType);
    const subIdx = this.subIdx;
    const cmdIdx = this.cmdIdx;
    if (isHovering) {
      this.hoverStateService.setHover({
        type: hoverType,
        commandId: { pathId, subIdx, cmdIdx },
        source: this.canvasType,
      });
    } else if (hoverType !== HoverType.Command && this.isHoveringOverCommand) {
      this.hoverStateService.setHover({
        type: HoverType.Command,
        commandId: { pathId, subIdx, cmdIdx },
        source: this.canvasType,
      });
    } else {
      this.hoverStateService.reset();
    }
    this.isHovering =
      this.isHoveringOverCommand
      && !this.isHoveringOverSplit
      && !this.isHoveringOverUnsplit
      && !this.isHoveringOverReverse
      && !this.isHoveringOverShiftBack
      && !this.isHoveringOverShiftForward;
  }
}

@Pipe({ name: 'toSvgText' })
export class SvgCommandPipe implements PipeTransform {
  transform(c: Command): string {
    if (c.svgChar === 'Z') {
      return `${c.svgChar}`;
    } else {
      const p = _.last(c.points);
      const x = _.round(p.x, 2);
      const y = _.round(p.y, 2);
      return `${c.svgChar} ${x}, ${y}`;
    }
  }
}
