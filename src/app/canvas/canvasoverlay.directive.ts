import * as $ from 'jquery';
import * as _ from 'lodash';
import * as CanvasUtil from './CanvasUtil';
import { Directive, ElementRef, HostListener, Input, AfterViewInit } from '@angular/core';
import { CanvasLayoutMixin } from './CanvasLayoutMixin';
import { Command } from '../scripts/paths';
import { CanvasType } from '..';
import { DestroyableMixin } from '../scripts/mixins';
import { MathUtil, Point, Matrix } from '../scripts/common';
import { AnimatorService } from '../services';
import { Observable } from 'rxjs/Observable';
import { Path } from '../scripts/paths';
import {
  Layer,
  VectorLayer,
  LayerUtil,
  PathLayer,
  ClipPathLayer,
  GroupLayer,
} from '../scripts/layers';
import {
  Store,
  State,
  SelectLayer,
  ClearLayerSelections,
  getActiveVectorLayer,
  getSelectedLayerIds,
  getHiddenLayerIds,
  getShapeShifterStartState,
  getShapeShifterEndState,
  Hover,
  HoverType,
  Selection,
  SelectionType,
} from '../store';
import 'rxjs/add/observable/combineLatest';

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
const DISABLED_ALPHA = 0.38;

const NORMAL_POINT_COLOR = '#2962FF'; // Blue A400
const SPLIT_POINT_COLOR = '#E65100'; // Orange 900
const HIGHLIGHT_COLOR = '#448AFF';
const POINT_BORDER_COLOR = '#000';
const POINT_TEXT_COLOR = '#fff';

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
  private vectorLayer: VectorLayer;
  // Normal mode variables.
  private hiddenLayerIds = new Set<string>();
  private selectedLayerIds = new Set<string>();
  // Shape Shifter mode variables.
  private shapeShifterPathLayerId: string;
  private shapeShifterHover: Hover;
  private shapeShifterSelections: ReadonlyArray<Selection>;

  constructor(
    readonly elementRef: ElementRef,
    private readonly store: Store<State>,
    private readonly animatorService: AnimatorService,
  ) {
    super();
    this.$canvas = $(elementRef.nativeElement);
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
          .subscribe(({ vectorLayer, pathLayerId, hover, selections }) => {
            this.vectorLayer = vectorLayer;
            this.shapeShifterPathLayerId = pathLayerId;
            this.shapeShifterHover = hover;
            this.shapeShifterSelections = selections;
            this.draw();
          }),
      );
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
      ctx.restore();
      this.drawLabeledPoints(ctx);
    }
    this.drawPixelGrid(ctx);
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

  // Draw any labeled points.
  private drawLabeledPoints(ctx: Context) {
    if (this.canvasType === CanvasType.Preview) {
      // Don't draw labeled points in the preview canvas.
      return;
    }

    const pathLayer = this.vectorLayer.findLayerById(this.shapeShifterPathLayerId) as PathLayer;
    const path = pathLayer.pathData;
    // if (this.currentHoverPreviewPath) {
    //   path = this.currentHoverPreviewPath;
    // }

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
      /*this.selectionHelper && this.selectionHelper.isDragTriggered()
        ? this.selectionHelper.getDraggableSplitIndex()
        :*/ undefined;

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
      if ((isAtLeastMedium || isHovering) && true /*this.appMode === AppMode.Selection*/) {
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

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    const hitLayer = this.hitTestForLayer(this.mouseEventToViewportCoords(event));
    const isMetaOrShiftPressed = event.metaKey || event.shiftKey;
    if (hitLayer) {
      const shouldToggle = true;
      this.store.dispatch(
        new SelectLayer(hitLayer.id, shouldToggle, !isMetaOrShiftPressed));
    } else if (!isMetaOrShiftPressed) {
      this.store.dispatch(new ClearLayerSelections());
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
  }

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
