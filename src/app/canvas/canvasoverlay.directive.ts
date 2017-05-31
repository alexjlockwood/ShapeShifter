import 'rxjs/add/observable/combineLatest';

import { CanvasType } from '..';
import { AnimatorService } from '../animator';
import { MathUtil, Matrix, Point } from '../scripts/common';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from '../scripts/layers';
import { DestroyableMixin } from '../scripts/mixins';
import { Path } from '../scripts/paths';
import { Command } from '../scripts/paths';
import {
  ClearLayerSelections,
  Hover,
  HoverType,
  SelectLayer,
  Selection,
  SelectionType,
  SetPathHover,
  SetUnpairedSubPath,
  ShapeShifterMode,
  State,
  Store,
} from '../store';
import {
  getActiveVectorLayer,
  getHiddenLayerIds,
  getSelectedLayerIds,
} from '../store/layers/selectors';
import {
  getPathHover,
  getShapeShifterEndState,
  getShapeShifterMode,
  getShapeShifterStartState,
} from '../store/shapeshifter/selectors';
import { CanvasLayoutMixin } from './CanvasLayoutMixin';
import * as CanvasUtil from './CanvasUtil';
import { MorphSubPathHelper } from './MorphSubPathHelper';
import { SegmentSplitter } from './SegmentSplitter';
import { SelectionHelper } from './SelectionHelper';
import { ShapeSplitter } from './ShapeSplitter';
import { AfterViewInit, Directive, ElementRef, HostListener, Input } from '@angular/core';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

// The line width of a highlight in css pixels.
const HIGHLIGHT_LINE_WIDTH = 6;
// The line dash of a highlight in css pixels.
const HIGHLIGHT_LINE_DASH = 5;
// The minimum distance between a point and a path that causes a snap.
const MIN_SNAP_THRESHOLD = 12;
// The distance of a mouse gesture that triggers a drag, in css pixels.
const DRAG_TRIGGER_TOUCH_SLOP = 6;
// The radius of a medium point in css pixels.
const MEDIUM_POINT_RADIUS = 8;
// The radius of a small point in css pixels.
const SMALL_POINT_RADIUS = MEDIUM_POINT_RADIUS / 1.7;

const SPLIT_POINT_RADIUS_FACTOR = 0.8;
const SELECTED_POINT_RADIUS_FACTOR = 1.25;
const POINT_BORDER_FACTOR = 1.075;
// TODO: disable the canvas if the paths aren't morphable
// const DISABLED_ALPHA = 0.38;

const NORMAL_POINT_COLOR = '#2962FF'; // Blue A400
const SPLIT_POINT_COLOR = '#E65100'; // Orange 900
const HIGHLIGHT_COLOR = '#448AFF';
const POINT_BORDER_COLOR = '#000';
const POINT_TEXT_COLOR = '#fff';

// TODO: make shape shifter mode work with clip paths
// TODO: make segment splitter work with trim paths
// TODO: make trim paths work with shifts/reversals
type Context = CanvasRenderingContext2D;

/**
 * A directive that draws overlay selections and other content on top
 * of the currently active vector layer.
 */
@Directive({ selector: '[appCanvasOverlay]' })
export class CanvasOverlayDirective
  extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit {

  @Input() canvasType: CanvasType;

  private readonly $canvas: JQuery;
  vectorLayer: VectorLayer;
  // Normal mode variables.
  private hiddenLayerIds = new Set<string>();
  private selectedLayerIds = new Set<string>();
  // Shape Shifter mode variables.
  private shapeShifterPathLayerId: string;
  shapeShifterMode: ShapeShifterMode;
  private shapeShifterHover: Hover;
  shapeShifterSelections: ReadonlyArray<Selection>;
  private currentHoverPreviewPath: Path | undefined;
  pairedSubPaths: Set<number>;
  unpairedSubPath: { source: CanvasType, subIdx: number };

  private selectionHelper: SelectionHelper | undefined;
  private morphSubPathHelper: MorphSubPathHelper | undefined;
  private segmentSplitter: SegmentSplitter | undefined;
  private shapeSplitter: ShapeSplitter | undefined;

  constructor(
    readonly elementRef: ElementRef,
    public readonly store: Store<State>,
    private readonly animatorService: AnimatorService,
  ) {
    super();
    this.$canvas = $(elementRef.nativeElement);
  }

  get isShapeShifterMode() {
    return !!this.shapeShifterPathLayerId;
  }

  private get overlayCtx() {
    return (this.$canvas.get(0) as HTMLCanvasElement).getContext('2d');
  }

  private get highlightLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale;
  }

  private get minSnapThreshold() {
    return MIN_SNAP_THRESHOLD / this.cssScale;
  }

  private get highlightLineDash() {
    return [
      HIGHLIGHT_LINE_DASH / this.cssScale,
      HIGHLIGHT_LINE_DASH / this.cssScale,
    ];
  }

  private get smallPointRadius() {
    return SMALL_POINT_RADIUS / this.cssScale;
  }

  private get mediumPointRadius() {
    return MEDIUM_POINT_RADIUS / this.cssScale;
  }

  private get splitPointRadius() {
    return this.mediumPointRadius * SPLIT_POINT_RADIUS_FACTOR;
  }

  private get selectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 1.9;
  }

  private get unselectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 3;
  }

  get dragTriggerTouchSlop() {
    return DRAG_TRIGGER_TOUCH_SLOP / this.cssScale;
  }

  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  get activePathLayer() {
    return this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
  }

  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  // TODO: only use this for shape shifter mode
  get activePath() {
    return this.activePathLayer.pathData;
  }

  ngAfterViewInit() {
    if (this.canvasType === CanvasType.Preview) {
      // Preview canvas specific setup.
      this.registerSubscription(
        Observable.combineLatest(
          this.animatorService.asObservable().map(event => event.vl),
          this.store.select(getActiveVectorLayer),
          this.store.select(getHiddenLayerIds),
          this.store.select(getSelectedLayerIds),
        ).subscribe(([animatedVl, activeVl, hiddenLayerIds, selectedLayerIds]) => {
          this.vectorLayer = animatedVl || activeVl;
          this.hiddenLayerIds = hiddenLayerIds;
          this.selectedLayerIds = selectedLayerIds;
          this.draw();
        }));
    } else {
      // Start & end canvas specific setup.
      const shapeShifterSelector =
        this.canvasType === CanvasType.Start
          ? getShapeShifterStartState
          : getShapeShifterEndState;
      this.registerSubscription(
        this.store.select(shapeShifterSelector)
          .subscribe(({
            vectorLayer,
            blockLayerId,
            hover,
            selections,
            pairedSubPaths,
            unpairedSubPath,
           }) => {
            this.vectorLayer = vectorLayer;
            this.shapeShifterPathLayerId = blockLayerId;
            this.shapeShifterHover = hover;
            this.shapeShifterSelections = selections;
            this.pairedSubPaths = pairedSubPaths;
            this.unpairedSubPath = unpairedSubPath;
            this.draw();
          }),
      );
      this.registerSubscription(
        this.store.select(getShapeShifterMode).subscribe(mode => {
          this.shapeShifterMode = mode;
          const pathLayer =
            this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
          if (this.shapeShifterMode === ShapeShifterMode.SplitCommands
            || (this.shapeShifterMode === ShapeShifterMode.SplitSubPaths
              && pathLayer
              && pathLayer.isStroked())) {
            const subIdxs = new Set<number>();
            for (const s of this.shapeShifterSelections) {
              subIdxs.add(s.subIdx);
            }
            const toArray = Array.from(subIdxs);
            const restrictToSubIdx = toArray.length ? toArray[0] : undefined;
            this.segmentSplitter = new SegmentSplitter(this, restrictToSubIdx);
          } else {
            this.segmentSplitter = undefined;
          }
          if (this.shapeShifterMode === ShapeShifterMode.Selection) {
            this.selectionHelper = new SelectionHelper(this);
          } else {
            this.selectionHelper = undefined;
          }
          if (this.shapeShifterMode === ShapeShifterMode.MorphSubPaths) {
            this.morphSubPathHelper = new MorphSubPathHelper(this);
            const selections =
              this.shapeShifterSelections.filter(s => s.type === SelectionType.SubPath);
            if (selections.length) {
              const { source, subIdx } = selections[0];
              // TODO: avoid calling this in a subscription (should automatically do this)
              // TODO: avoid calling this in a subscription (should automatically do this)
              // TODO: avoid calling this in a subscription (should automatically do this)
              // TODO: avoid calling this in a subscription (should automatically do this)
              // TODO: avoid calling this in a subscription (should automatically do this)
              this.store.dispatch(new SetUnpairedSubPath({ source, subIdx }));
            }
          } else {
            this.morphSubPathHelper = undefined;
          }
          if (this.shapeShifterMode === ShapeShifterMode.SplitSubPaths
            && pathLayer
            && pathLayer.isFilled()) {
            this.shapeSplitter = new ShapeSplitter(this);
          } else {
            this.shapeSplitter = undefined;
          }
          this.currentHoverPreviewPath = undefined;
          this.draw();
        }));
      const updateCurrentHoverFn = (hover: Hover | undefined) => {
        let previewPath: Path = undefined;
        if (this.vectorLayer && this.activePath && hover) {
          // If the user is hovering over the inspector split button, then build
          // a snapshot of what the path would look like after the action
          // and display the result.
          const mutator = this.activePath.mutate();
          const { type, subIdx, cmdIdx } = hover;
          switch (type) {
            case HoverType.Split:
              previewPath = mutator.splitCommandInHalf(subIdx, cmdIdx).build();
              break;
            case HoverType.Unsplit:
              previewPath = mutator.unsplitCommand(subIdx, cmdIdx).build();
              break;
          }
        }
        this.currentHoverPreviewPath = previewPath;
        this.draw();
      };
      // TODO: avoid re-executing the draw by combining with the above subscriptions
      // TODO: avoid re-executing the draw by combining with the above subscriptions
      // TODO: avoid re-executing the draw by combining with the above subscriptions
      // TODO: avoid re-executing the draw by combining with the above subscriptions
      // TODO: avoid re-executing the draw by combining with the above subscriptions
      this.registerSubscription(
        this.store.select(getPathHover).subscribe(
          hover => {
            if (!hover) {
              // Clear the current hover.
              updateCurrentHoverFn(undefined);
              return;
            }
            if (hover.source !== this.canvasType
              && hover.type !== HoverType.Point) {
              updateCurrentHoverFn(undefined);
              return;
            }
            updateCurrentHoverFn(hover);
          }));
    }
  }

  // @Override
  onDimensionsChanged() {
    const { w, h } = this.getViewport();
    this.$canvas.attr({ width: w * this.attrScale, height: h * this.attrScale });
    this.$canvas.css({ width: w * this.cssScale, height: h * this.cssScale });
    this.draw();
  }

  draw() {
    const ctx = this.overlayCtx;
    if (this.vectorLayer) {
      const { w, h } = this.getViewport();
      ctx.save();
      ctx.scale(this.attrScale, this.attrScale);
      ctx.clearRect(0, 0, w, h);
      this.drawLayerSelections(ctx, this.vectorLayer);
      this.drawHighlights(ctx);
      ctx.restore();
      // Draw points in terms of physical pixels, not viewport pixels.
      this.drawLabeledPoints(ctx);
      this.drawDraggingPoints(ctx);
      this.drawFloatingPreviewPoint(ctx);
      this.drawFloatingSplitFilledPathPreviewPoints(ctx);
    }
    this.drawPixelGrid(ctx);
  }

  // Recursively draws all layer selections to the canvas.
  private drawLayerSelections(ctx: Context, curr: Layer) {
    if (this.hiddenLayerIds.has(curr.id)) {
      // Don't draw selections for hidden layers.
      return;
    }
    if (this.selectedLayerIds.has(curr.id)) {
      const root = this.vectorLayer;
      const flattenedTransform = LayerUtil.getFlattenedTransformForLayer(root, curr.id);
      if (curr instanceof ClipPathLayer) {
        if (curr.pathData && curr.pathData.getCommands().length) {
          CanvasUtil.executeCommands(ctx, curr.pathData.getCommands(), flattenedTransform);
          executeHighlights(ctx, HIGHLIGHT_COLOR, this.highlightLineWidth, this.highlightLineDash);
          ctx.clip();
        }
      } else if (curr instanceof PathLayer) {
        if (curr.pathData && curr.pathData.getCommands().length) {
          ctx.save();
          CanvasUtil.executeCommands(ctx, curr.pathData.getCommands(), flattenedTransform);
          executeHighlights(ctx, HIGHLIGHT_COLOR, this.highlightLineWidth);
          ctx.restore();
        }
      } else if (curr instanceof VectorLayer || curr instanceof GroupLayer) {
        const bounds = curr.getBoundingBox();
        if (bounds) {
          ctx.save();
          const { a, b, c, d, e, f } = flattenedTransform;
          ctx.transform(a, b, c, d, e, f);
          ctx.beginPath();
          ctx.rect(bounds.l, bounds.t, bounds.r - bounds.l, bounds.b - bounds.t);
          executeHighlights(ctx, HIGHLIGHT_COLOR, this.highlightLineWidth);
          ctx.restore();
        }
      }
    }
    curr.children.forEach(child => this.drawLayerSelections(ctx, child));
  }

  // Draw any highlighted segments.
  private drawHighlights(ctx: Context) {
    if (!this.isShapeShifterMode) {
      return;
    }
    if (this.canvasType === CanvasType.Preview) {
      return;
    }

    const flattenedTransform =
      LayerUtil.getFlattenedTransformForLayer(this.vectorLayer, this.shapeShifterPathLayerId);
    const pathLayer = this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
    const activePath = pathLayer.pathData;
    const currentHover = this.shapeShifterHover;

    if (this.selectionHelper) {
      // Draw any highlighted subpaths. We'll highlight a subpath if a subpath
      // selection or a point selection exists.
      const selectedSubPaths =
        _.chain(this.shapeShifterSelections)
          .filter(s => {
            return s.source === this.canvasType
              && (s.type === SelectionType.Point
                || s.type === SelectionType.SubPath);
          })
          .map(s => s.subIdx)
          .uniq()
          .map(subIdx => activePath.getSubPath(subIdx))
          .filter(subPath => !subPath.isCollapsing())
          .value();

      for (const subPath of selectedSubPaths) {
        // If the subpath has a split segment, highlight it in orange. Otherwise,
        // use the default blue highlight color.
        const cmds = subPath.getCommands();
        const isSplitSubPath = cmds.some(c => c.isSplitSegment());
        const highlightColor = isSplitSubPath ? SPLIT_POINT_COLOR : HIGHLIGHT_COLOR;
        CanvasUtil.executeCommands(ctx, cmds, flattenedTransform);
        executeHighlights(ctx, highlightColor, this.selectedSegmentLineWidth);
      }

      const segmentSelections =
        this.shapeShifterSelections.filter(s => s.type === SelectionType.Segment)
          .filter(s => s.source === this.canvasType)
          .map(s => { return { subIdx: s.subIdx, cmdIdx: s.cmdIdx }; });
      const hover = currentHover;
      if (hover
        && hover.source === this.canvasType
        && hover.type === HoverType.Segment) {
        segmentSelections.push({
          subIdx: hover.subIdx,
          cmdIdx: hover.cmdIdx,
        });
      }
      const segmentSelectionCmds =
        segmentSelections
          .map(s => activePath.getCommand(s.subIdx, s.cmdIdx))
          .filter(cmd => cmd.isSplitSegment());
      CanvasUtil.executeCommands(ctx, segmentSelectionCmds, flattenedTransform);
      executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
    } else if (this.segmentSplitter && this.segmentSplitter.getProjectionOntoPath()) {
      // Highlight the segment as the user hovers over it.
      const { subIdx, cmdIdx, projection: { d } } =
        this.segmentSplitter.getProjectionOntoPath();
      if (d < this.minSnapThreshold) {
        CanvasUtil.executeCommands(ctx, [activePath.getCommand(subIdx, cmdIdx)], flattenedTransform);
        executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
      }
    }

    // Draw any existing split shape segments to the canvas.
    const cmds =
      _.chain(activePath.getSubPaths())
        .filter(s => !s.isCollapsing())
        .flatMap(s => s.getCommands() as Command[])
        .filter(c => c.isSplitSegment())
        .value();
    CanvasUtil.executeCommands(ctx, cmds, flattenedTransform);
    executeHighlights(ctx, SPLIT_POINT_COLOR, this.unselectedSegmentLineWidth);

    if (this.morphSubPathHelper) {
      const currUnpair = this.unpairedSubPath;
      if (currUnpair) {
        // Draw the current unpaired subpath in orange, if it exists.
        const { source, subIdx } = currUnpair;
        const subPath = activePath.getSubPath(subIdx);
        if (source === this.canvasType) {
          CanvasUtil.executeCommands(ctx, subPath.getCommands(), flattenedTransform);
          executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
        }
      }
      const pairedSubPaths = this.pairedSubPaths;
      const hasHover =
        currentHover
        && currentHover.source === this.canvasType
        && currentHover.type === HoverType.SubPath;
      if (hasHover) {
        pairedSubPaths.delete(currentHover.subIdx);
      }
      if (pairedSubPaths.size) {
        // Draw any already paired subpaths in blue.
        const pairedCmds =
          _.flatMap(
            Array.from(pairedSubPaths),
            subIdx => activePath.getSubPath(subIdx).getCommands() as Command[]);
        CanvasUtil.executeCommands(ctx, pairedCmds, flattenedTransform);
        executeHighlights(ctx, NORMAL_POINT_COLOR, this.selectedSegmentLineWidth);
      }
      if (hasHover) {
        // Highlight the hover in orange, if it exists.
        const hoverCmds = activePath.getSubPath(currentHover.subIdx).getCommands();
        CanvasUtil.executeCommands(ctx, hoverCmds, flattenedTransform);
        executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
      }
    } else if (this.shapeSplitter) {
      // If we are splitting a filled subpath, draw the in progress drag segment.
      const proj1 = this.shapeSplitter.getInitialProjectionOntoPath();
      const proj2 = this.shapeSplitter.getFinalProjectionOntoPath();
      if (proj1) {
        // Draw a line from the starting projection to the final projection (or
        // to the last known mouse location, if one doesn't exist).
        const startPoint =
          applyGroupTransform(new Point(proj1.projection.x, proj1.projection.y), flattenedTransform);
        const endPoint = proj2
          ? applyGroupTransform(new Point(proj2.projection.x, proj2.projection.y), flattenedTransform)
          : this.shapeSplitter.getLastKnownMouseLocation();
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
      }
      if (!proj1 || proj2) {
        // Highlight the segment as the user hovers over it.
        const projectionOntoPath = this.shapeSplitter.getCurrentProjectionOntoPath();
        if (projectionOntoPath) {
          const projection = projectionOntoPath.projection;
          if (projection && projection.d < this.minSnapThreshold) {
            const { subIdx, cmdIdx } = projectionOntoPath;
            CanvasUtil.executeCommands(ctx, [activePath.getCommand(subIdx, cmdIdx)], flattenedTransform);
            executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
          }
        }
      }
    }
  }

  // Draw any labeled points.
  private drawLabeledPoints(ctx: Context) {
    if (!this.isShapeShifterMode) {
      return;
    }
    if (this.canvasType === CanvasType.Preview) {
      // Don't draw labeled points in the preview canvas.
      return;
    }

    const pathLayer =
      this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
    let path = pathLayer.pathData;
    if (this.currentHoverPreviewPath) {
      path = this.currentHoverPreviewPath;
    }

    interface PointInfo {
      cmd: Command;
      subIdx: number;
      cmdIdx: number;
    }

    // Create a list of all path points in their normal order.
    const pointInfos =
      _.chain(path.getSubPaths())
        .filter(subPath => !subPath.isCollapsing())
        .map((subPath, subIdx) => {
          return subPath.getCommands()
            .map((cmd, cmdIdx) => {
              return { cmd, subIdx, cmdIdx } as PointInfo;
            });
        })
        .flatMap(pis => pis)
        .reverse()
        .value();

    const subPathSelections =
      this.shapeShifterSelections.filter(s => s.type === SelectionType.SubPath);
    const pointSelections =
      this.shapeShifterSelections.filter(s => s.type === SelectionType.Point);

    // Remove all selected points from the list.
    const isPointInfoSelectedFn = ({ subIdx, cmdIdx }: PointInfo) => {
      return subPathSelections.some(s => s.subIdx === subIdx)
        || pointSelections.some(s => s.subIdx === subIdx && s.cmdIdx === cmdIdx);
    };
    const selectedPointInfos = _.remove(pointInfos, pi => isPointInfoSelectedFn(pi));
    // Remove any subpath points that share the same subIdx as an existing selection.
    // We'll call these 'medium' points (i.e. labeled, but not selected), and we'll
    // always draw selected points on top of medium points, and medium points
    // on top of small points.
    const isPointInfoAtLeastMediumFn = ({ subIdx }: PointInfo) => {
      return subPathSelections.some(s => s.subIdx === subIdx)
        || pointSelections.some(s => s.subIdx === subIdx);
    };
    pointInfos.push(..._.remove(pointInfos, pi => isPointInfoAtLeastMediumFn(pi)));
    pointInfos.push(...selectedPointInfos);

    const currentHover = this.shapeShifterHover;

    // Remove a hovering point, if one exists.
    const hoveringPointInfos =
      _.remove(pointInfos, ({ subIdx, cmdIdx }: PointInfo) => {
        const hover = currentHover;
        return hover
          && hover.type === HoverType.Point
          && hover.subIdx === subIdx
          && hover.cmdIdx === cmdIdx;
      });
    // Remove any subpath points that share the same subIdx as an existing hover.
    const isPointInfoHoveringFn = ({ subIdx }: PointInfo) => {
      const hover = currentHover;
      return hover
        && hover.type !== HoverType.Segment
        && hover.subIdx === subIdx;
    };
    // Similar to above, always draw hover points on top of subpath hover points.
    pointInfos.push(..._.remove(pointInfos, pi => isPointInfoHoveringFn(pi)));
    pointInfos.push(...hoveringPointInfos);

    const draggingIndex =
      this.selectionHelper && this.selectionHelper.isDragTriggered()
        ? this.selectionHelper.getDraggableSplitIndex()
        : undefined;

    for (const { cmd, subIdx, cmdIdx } of pointInfos) {
      if (draggingIndex
        && subIdx === draggingIndex.subIdx
        && cmdIdx === draggingIndex.cmdIdx) {
        // Skip the currently dragged point. We'll draw that next.
        continue;
      }
      let radius = this.smallPointRadius;
      let text: string = undefined;
      const isHovering = isPointInfoHoveringFn({ cmd, subIdx, cmdIdx });
      const isAtLeastMedium = isPointInfoAtLeastMediumFn({ cmd, subIdx, cmdIdx });
      if ((isAtLeastMedium || isHovering) && this.shapeShifterMode === ShapeShifterMode.Selection) {
        radius = this.mediumPointRadius * SELECTED_POINT_RADIUS_FACTOR;
        const isPointEnlargedFn = (source: CanvasType, sIdx: number, cIdx: number) => {
          return pointSelections.some(s => {
            return s.subIdx === sIdx && s.cmdIdx === cIdx && s.source === source;
          });
        };
        if ((isHovering && cmdIdx === currentHover.cmdIdx)
          || isPointEnlargedFn(CanvasType.Start, subIdx, cmdIdx)
          || isPointEnlargedFn(CanvasType.End, subIdx, cmdIdx)) {
          radius /= SPLIT_POINT_RADIUS_FACTOR;
        }
        text = (cmdIdx + 1).toString();
      }
      let color: string;
      if (cmd.isSplitPoint()) {
        radius *= SPLIT_POINT_RADIUS_FACTOR;
        color = SPLIT_POINT_COLOR;
      } else {
        color = NORMAL_POINT_COLOR;
      }
      const flattenedTransform =
        LayerUtil.getFlattenedTransformForLayer(this.vectorLayer, this.shapeShifterPathLayerId);
      executeLabeledPoint(
        ctx,
        this.attrScale,
        applyGroupTransform(_.last(cmd.getPoints()), flattenedTransform),
        radius,
        color,
        text,
      );
    }
  }

  // Draw any actively dragged points along the path in selection mode.
  private drawDraggingPoints(ctx: Context) {
    if (!this.isShapeShifterMode) {
      return;
    }
    if (this.shapeShifterMode !== ShapeShifterMode.Selection
      || !this.selectionHelper
      || !this.selectionHelper.isDragTriggered()) {
      return;
    }
    const flattenedTransform =
      LayerUtil.getFlattenedTransformForLayer(this.vectorLayer, this.shapeShifterPathLayerId);
    const { x, y, d } = this.selectionHelper.getProjectionOntoPath().projection;
    const point =
      d < this.minSnapThreshold
        ? applyGroupTransform(new Point(x, y), flattenedTransform)
        : this.selectionHelper.getLastKnownMouseLocation();
    executeLabeledPoint(
      ctx,
      this.attrScale,
      point,
      this.splitPointRadius,
      SPLIT_POINT_COLOR);
  }

  // Draw a floating point preview over the canvas in split commands mode
  // and split subpaths mode for stroked paths.
  private drawFloatingPreviewPoint(ctx: Context) {
    if (!this.isShapeShifterMode) {
      return;
    }
    const pathLayer =
      this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
    if (this.shapeShifterMode !== ShapeShifterMode.SplitCommands
      && this.shapeShifterMode !== ShapeShifterMode.SplitSubPaths
      && !pathLayer.isStroked()
      || !this.segmentSplitter
      || !this.segmentSplitter.getProjectionOntoPath()) {
      return;
    }
    const { x, y, d } = this.segmentSplitter.getProjectionOntoPath().projection;
    if (d < this.minSnapThreshold) {
      const flattenedTransform =
        LayerUtil.getFlattenedTransformForLayer(
          this.vectorLayer, this.shapeShifterPathLayerId);
      executeLabeledPoint(
        ctx,
        this.attrScale,
        applyGroupTransform(new Point(x, y), flattenedTransform),
        this.splitPointRadius,
        SPLIT_POINT_COLOR);
    }
  }

  // Draw the floating points on top of the drag line in split filled subpath mode.
  private drawFloatingSplitFilledPathPreviewPoints(ctx: Context) {
    if (!this.isShapeShifterMode) {
      return;
    }
    if (this.shapeShifterMode !== ShapeShifterMode.SplitSubPaths || !this.shapeSplitter) {
      return;
    }
    const flattenedTransform =
      LayerUtil.getFlattenedTransformForLayer(
        this.vectorLayer, this.shapeShifterPathLayerId);
    const proj1 = this.shapeSplitter.getInitialProjectionOntoPath();
    if (proj1) {
      const proj2 = this.shapeSplitter.getFinalProjectionOntoPath();
      executeLabeledPoint(
        ctx,
        this.attrScale,
        applyGroupTransform(new Point(proj1.projection.x, proj1.projection.y), flattenedTransform),
        this.splitPointRadius,
        SPLIT_POINT_COLOR);
      if (this.shapeSplitter.willFinalProjectionOntoPathCreateSplitPoint()) {
        const endPoint = proj2
          ? applyGroupTransform(new Point(proj2.projection.x, proj2.projection.y), flattenedTransform)
          : this.shapeSplitter.getLastKnownMouseLocation();
        executeLabeledPoint(
          ctx,
          this.attrScale,
          endPoint,
          this.splitPointRadius,
          SPLIT_POINT_COLOR);
      }
    } else if (this.shapeSplitter.getCurrentProjectionOntoPath()) {
      const { x, y, d } = this.shapeSplitter.getCurrentProjectionOntoPath().projection;
      if (d < this.minSnapThreshold) {
        executeLabeledPoint(
          ctx,
          this.attrScale,
          applyGroupTransform(new Point(x, y), flattenedTransform),
          this.splitPointRadius,
          SPLIT_POINT_COLOR);
      }
    }
  }

  // Draws the pixel grid on top of the canvas content.
  private drawPixelGrid(ctx: Context) {
    // Note that we draw the pixel grid in terms of physical pixels,
    // not viewport pixels.
    if (this.cssScale > 4) {
      ctx.save();
      ctx.fillStyle = 'rgba(128, 128, 128, .25)';
      const devicePixelRatio = window.devicePixelRatio || 1;
      const viewport = this.getViewport();
      for (let x = 1; x < viewport.w; x++) {
        ctx.fillRect(
          x * this.attrScale - devicePixelRatio / 2,
          0,
          devicePixelRatio,
          viewport.h * this.attrScale);
      }
      for (let y = 1; y < viewport.h; y++) {
        ctx.fillRect(
          0,
          y * this.attrScale - devicePixelRatio / 2,
          viewport.w * this.attrScale,
          devicePixelRatio);
      }
      ctx.restore();
    }
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    const mouseDown = this.mouseEventToViewportCoords(event);
    if (this.isShapeShifterMode) {
      if (this.shapeShifterMode === ShapeShifterMode.Selection) {
        this.selectionHelper.onMouseDown(mouseDown, event.shiftKey || event.metaKey);
      } else if (this.shapeShifterMode === ShapeShifterMode.MorphSubPaths) {
        this.morphSubPathHelper.onMouseDown(mouseDown, event.shiftKey || event.metaKey);
      } else if (this.shapeShifterMode === ShapeShifterMode.SplitCommands) {
        this.segmentSplitter.onMouseDown(mouseDown);
      } else if (this.shapeShifterMode === ShapeShifterMode.SplitSubPaths) {
        const pathLayer = this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
        if (pathLayer.isStroked()) {
          this.segmentSplitter.onMouseDown(mouseDown);
        } else {
          this.shapeSplitter.onMouseDown(mouseDown);
        }
      }
    } else {
      const hitLayer = this.hitTestForLayer(mouseDown);
      const isMetaOrShiftPressed = event.metaKey || event.shiftKey;
      if (hitLayer) {
        const shouldToggle = true;
        this.store.dispatch(
          new SelectLayer(hitLayer.id, shouldToggle, !isMetaOrShiftPressed));
      } else if (!isMetaOrShiftPressed) {
        this.store.dispatch(new ClearLayerSelections());
      }
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isShapeShifterMode) {
      return;
    }
    const mouseMove = this.mouseEventToViewportCoords(event);
    if (this.shapeShifterMode === ShapeShifterMode.Selection) {
      this.selectionHelper.onMouseMove(mouseMove);
    } else if (this.shapeShifterMode === ShapeShifterMode.MorphSubPaths) {
      this.morphSubPathHelper.onMouseMove(mouseMove);
    } else if (this.shapeShifterMode === ShapeShifterMode.SplitCommands) {
      this.segmentSplitter.onMouseMove(mouseMove);
    } else if (this.shapeShifterMode === ShapeShifterMode.SplitSubPaths) {
      const pathLayer = this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
      if (pathLayer.isStroked()) {
        this.segmentSplitter.onMouseMove(mouseMove);
      } else {
        this.shapeSplitter.onMouseMove(mouseMove);
      }
    }
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    if (!this.isShapeShifterMode) {
      return;
    }
    const mouseUp = this.mouseEventToViewportCoords(event);
    if (this.shapeShifterMode === ShapeShifterMode.Selection) {
      this.selectionHelper.onMouseUp(mouseUp, event.shiftKey || event.metaKey);
    } else if (this.shapeShifterMode === ShapeShifterMode.MorphSubPaths) {
      this.morphSubPathHelper.onMouseUp(mouseUp);
    } else if (this.shapeShifterMode === ShapeShifterMode.SplitCommands) {
      this.segmentSplitter.onMouseUp(mouseUp);
    } else if (this.shapeShifterMode === ShapeShifterMode.SplitSubPaths) {
      const pathLayer = this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
      if (pathLayer.isStroked()) {
        this.segmentSplitter.onMouseUp(mouseUp);
      } else {
        this.shapeSplitter.onMouseUp(mouseUp);
      }
    }
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
    if (!this.isShapeShifterMode) {
      return;
    }
    const mouseLeave = this.mouseEventToViewportCoords(event);
    if (this.shapeShifterMode === ShapeShifterMode.Selection) {
      // TODO: how to handle the case where the mouse leaves and re-enters mid-gesture?
      this.selectionHelper.onMouseLeave(mouseLeave);
    } else if (this.shapeShifterMode === ShapeShifterMode.MorphSubPaths) {
      this.morphSubPathHelper.onMouseLeave(mouseLeave);
    } else if (this.shapeShifterMode === ShapeShifterMode.SplitCommands) {
      this.segmentSplitter.onMouseLeave(mouseLeave);
    } else if (this.shapeShifterMode === ShapeShifterMode.SplitSubPaths) {
      const pathLayer = this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
      if (pathLayer.isStroked()) {
        this.segmentSplitter.onMouseLeave(mouseLeave);
      } else {
        this.shapeSplitter.onMouseLeave(mouseLeave);
      }
    }
    this.store.dispatch(new SetPathHover(undefined));
  }

  // TODO: override onClick()?
  // TODO: override onClick()?
  // TODO: override onClick()?
  // TODO: override onClick()?
  // TODO: override onClick()?

  private mouseEventToViewportCoords(event: MouseEvent) {
    const canvasOffset = this.$canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.cssScale;
    const y = (event.pageY - canvasOffset.top) / this.cssScale;
    return new Point(x, y);
  }

  private hitTestForLayer(point: Point) {
    const root = this.vectorLayer;
    if (!root) {
      return undefined;
    }
    const recurseFn = (layer: Layer): Layer => {
      if (layer instanceof PathLayer && layer.pathData) {
        const transformedPoint =
          MathUtil.transformPoint(
            point, LayerUtil.getFlattenedTransformForLayer(root, layer.id).invert());
        let isSegmentInRangeFn: (distance: number, cmd: Command) => boolean;
        isSegmentInRangeFn = distance => {
          let maxDistance = this.minSnapThreshold;
          if (layer.isStroked()) {
            maxDistance = Math.max(maxDistance, layer.strokeWidth / 2);
          }
          return distance <= maxDistance;
        };
        const findShapesInRange = layer.isFilled();
        const hitResult = layer.pathData.hitTest(
          transformedPoint, {
            isSegmentInRangeFn,
            findShapesInRange,
          });
        return hitResult.isHit ? layer : undefined;
      }
      // Use 'hitTestLayer || h' and not the other way around because of reverse z-order.
      return layer.children.reduce((h, l) => recurseFn(l) || h, undefined);
    };
    return recurseFn(root) as PathLayer;
  }

  // TODO: make it clear this is only meant to be called in shape shifter mode
  performHitTest(mousePoint: Point, opts: HitTestOpts = {}) {
    const flattenedTransform =
      LayerUtil.getFlattenedTransformForLayer(
        this.vectorLayer, this.shapeShifterPathLayerId);
    const transformedMousePoint =
      MathUtil.transformPoint(mousePoint, flattenedTransform.invert());
    let isPointInRangeFn: (distance: number, cmd: Command) => boolean;
    if (!opts.noPoints) {
      isPointInRangeFn = (distance, cmd) => {
        const multiplyFactor = cmd.isSplitPoint() ? SPLIT_POINT_RADIUS_FACTOR : 1;
        return distance <= this.mediumPointRadius * multiplyFactor;
      };
    }
    const pathLayer =
      this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
    let isSegmentInRangeFn: (distance: number, cmd: Command) => boolean;
    if (!opts.noSegments) {
      isSegmentInRangeFn = distance => {
        let maxDistance = this.minSnapThreshold;
        if (pathLayer.isStroked()) {
          maxDistance = Math.max(maxDistance, pathLayer.strokeWidth / 2);
        }
        return distance <= maxDistance;
      };
    }
    const findShapesInRange = pathLayer.isFilled() && !opts.noShapes;
    const restrictToSubIdx = opts.restrictToSubIdx;
    return pathLayer.pathData.hitTest(
      transformedMousePoint, {
        isPointInRangeFn,
        isSegmentInRangeFn,
        findShapesInRange,
        restrictToSubIdx,
      });
  }
}

function executeHighlights(
  ctx: Context,
  color: string,
  lineWidth: number,
  lineDash: number[] = [],
) {
  ctx.save();
  ctx.setLineDash(lineDash);
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

// Draws a labeled point with optional text.
function executeLabeledPoint(
  ctx: Context,
  attrScale: number,
  point: Point,
  radius: number,
  color: string,
  text?: string,
) {
  // Convert the point and the radius to physical pixel coordinates.
  // We do this to avoid fractional font sizes less than 1px, which
  // show up OK on Chrome but not on Firefox or Safari.
  point = MathUtil.transformPoint(
    point, Matrix.fromScaling(attrScale, attrScale));
  radius *= attrScale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * POINT_BORDER_FACTOR, 0, 2 * Math.PI, false);
  ctx.fillStyle = POINT_BORDER_COLOR;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
  ctx.fillStyle = color;
  ctx.fill();

  if (text) {
    ctx.beginPath();
    ctx.fillStyle = POINT_TEXT_COLOR;
    ctx.font = radius + 'px Roboto, Helvetica Neue, sans-serif';
    const width = ctx.measureText(text).width;
    // TODO: is there a better way to get the height?
    const height = ctx.measureText('o').width;
    ctx.fillText(text, point.x - width / 2, point.y + height / 2);
    ctx.fill();
  }
  ctx.restore();
}

// Takes a path point and transforms it so that its coordinates are in terms
// of the VectorLayer's viewport coordinates.
function applyGroupTransform(mousePoint: Point, transform: Matrix) {
  return MathUtil.transformPoint(mousePoint, transform);
}

interface HitTestOpts {
  noPoints?: boolean;
  noSegments?: boolean;
  noShapes?: boolean;
  restrictToSubIdx?: number[];
}
