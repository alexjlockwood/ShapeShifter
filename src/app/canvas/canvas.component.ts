import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  Input, ViewChildren, QueryList, ChangeDetectionStrategy
} from '@angular/core';
import { Path, SubPath, Command } from '../scripts/paths';
import { PathLayer, ClipPathLayer, LayerUtil } from '../scripts/layers';
import { CanvasType } from '../CanvasType';
import { Point, Matrix, MathUtil, ColorUtil } from '../scripts/common';
import {
  AnimatorService,
  CanvasResizeService,
  AppModeService, AppMode,
  SelectionService, SelectionType,
  StateService, MorphStatus,
  HoverService, HoverType, Hover,
  SettingsService,
  FilePickerService,
} from '../services';
import { CanvasRulerDirective } from './canvasruler.directive';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { SegmentSplitter } from './SegmentSplitter';
import { CanvasSelector } from './CanvasSelector';
import { ShapeSplitter } from './ShapeSplitter';

const SPLIT_POINT_RADIUS_FACTOR = 0.8;
const SELECTED_POINT_RADIUS_FACTOR = 1.25;
const POINT_BORDER_FACTOR = 1.075;
const DISABLED_ALPHA = 0.38;

// Canvas margin in css pixels.
export const CANVAS_MARGIN = 36;
// Default viewport size in viewport pixels.
export const DEFAULT_VIEWPORT_SIZE = 24;
// The line width of a highlight in css pixels.
const HIGHLIGHT_LINE_WIDTH = 6;
// The distance of a mouse gesture that triggers a drag, in css pixels.
const DRAG_TRIGGER_TOUCH_SLOP = 6;
// The minimum distance between a point and a path that causes a snap.
const MIN_SNAP_THRESHOLD = 12;
// The radius of a medium point in css pixels.
const MEDIUM_POINT_RADIUS = 8;
// The radius of a small point in css pixels.
const SMALL_POINT_RADIUS = MEDIUM_POINT_RADIUS / 1.7;
// The size of a dashed outline in css pixels.
const DASH_SIZE = 20;

const NORMAL_POINT_COLOR = '#2962FF'; // Blue A400
const SPLIT_POINT_COLOR = '#E65100'; // Orange 900
const HIGHLIGHT_COLOR = '#448AFF';
const POINT_BORDER_COLOR = '#000';
const POINT_TEXT_COLOR = '#fff';

type Context = CanvasRenderingContext2D;

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() canvasType: CanvasType;
  @ViewChild('canvasContainer') private canvasContainerRef: ElementRef;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;
  @ViewChild('overlayCanvas') private overlayCanvasRef: ElementRef;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  private canvasContainer: JQuery;
  private renderingCanvas: JQuery;
  private overlayCanvas: JQuery;
  private offscreenLayerCanvas: JQuery;
  private offscreenSubPathCanvas: JQuery;
  private renderingCtx: Context;
  private overlayCtx: Context;
  private offscreenLayerCtx: Context;
  private offscreenSubPathCtx: Context;
  private isViewInit: boolean;
  private cssContainerWidth = 1;
  private cssContainerHeight = 1;
  private vlSize = { width: DEFAULT_VIEWPORT_SIZE, height: DEFAULT_VIEWPORT_SIZE };
  private currentHoverPreviewPath: Path;
  private canvasSelector: CanvasSelector | undefined;
  private segmentSplitter: SegmentSplitter | undefined;
  private shapeSplitter: ShapeSplitter | undefined;
  private readonly subscriptions: Subscription[] = [];

  // TODO: use this somehow in the UI?
  private disabledSubPathIndices: number[] = [];

  constructor(
    private readonly elementRef: ElementRef,
    readonly appModeService: AppModeService,
    private readonly canvasResizeService: CanvasResizeService,
    readonly hoverService: HoverService,
    readonly stateService: StateService,
    private readonly animatorService: AnimatorService,
    readonly selectionService: SelectionService,
    private readonly settingsService: SettingsService,
    private readonly filePickerService: FilePickerService,
  ) { }

  ngAfterViewInit() {
    this.isViewInit = true;
    this.canvasContainer = $(this.canvasContainerRef.nativeElement);
    this.renderingCanvas = $(this.renderingCanvasRef.nativeElement);
    this.overlayCanvas = $(this.overlayCanvasRef.nativeElement);
    this.offscreenLayerCanvas = $(document.createElement('canvas'));
    this.offscreenSubPathCanvas = $(document.createElement('canvas'));
    const getCtxFn = (canvas: JQuery) => {
      return (canvas.get(0) as HTMLCanvasElement).getContext('2d');
    };
    this.renderingCtx = getCtxFn(this.renderingCanvas);
    this.overlayCtx = getCtxFn(this.overlayCanvas);
    this.offscreenLayerCtx = getCtxFn(this.offscreenLayerCanvas);
    this.offscreenSubPathCtx = getCtxFn(this.offscreenSubPathCanvas);
    this.subscribeTo(
      this.stateService.getActivePathIdObservable(this.canvasType),
      () => {
        const vl = this.stateService.getVectorLayer(this.canvasType);
        const newWidth = vl ? vl.width : DEFAULT_VIEWPORT_SIZE;
        const newHeight = vl ? vl.height : DEFAULT_VIEWPORT_SIZE;
        const didSizeChange =
          this.vlSize.width !== newWidth || this.vlSize.height !== newHeight;
        this.vlSize = { width: newWidth, height: newHeight };
        if (didSizeChange) {
          this.resizeAndDraw();
        } else {
          this.draw();
        }
      });
    this.subscriptions.push(
      this.canvasResizeService.asObservable()
        .subscribe(size => {
          const oldWidth = this.cssContainerWidth;
          const oldHeight = this.cssContainerHeight;
          this.cssContainerWidth = Math.max(1, size.width - CANVAS_MARGIN * 2);
          this.cssContainerHeight = Math.max(1, size.height - CANVAS_MARGIN * 2);
          if (this.cssContainerWidth !== oldWidth
            || this.cssContainerHeight !== oldHeight) {
            this.resizeAndDraw();
          }
        }));
    if (this.canvasType === CanvasType.Preview) {
      // Preview canvas specific setup.
      const interpolatePreviewFn = () => {
        const fraction = this.animatorService.getAnimatedValue();
        const startVl = this.stateService.getVectorLayer(CanvasType.Start);
        const previewVl = this.stateService.getVectorLayer(CanvasType.Preview);
        const endVl = this.stateService.getVectorLayer(CanvasType.End);
        if (startVl && previewVl && endVl
          && startVl.isMorphableWith(previewVl)
          && previewVl.isMorphableWith(endVl)) {
          LayerUtil.deepInterpolate(startVl, previewVl, endVl, fraction);
        }
        this.draw();
      };
      this.subscribeTo(
        this.stateService.getActivePathIdObservable(this.canvasType),
        () => interpolatePreviewFn());
      this.subscribeTo(
        this.animatorService.getAnimatedValueObservable(),
        () => interpolatePreviewFn());
      this.subscribeTo(this.settingsService.getCanvasSettingsObservable());
      this.subscribeTo(this.stateService.getMorphStatusObservable());
    } else {
      // Non-preview canvas specific setup.
      this.subscribeTo(this.stateService.getActivePathIdObservable(this.canvasType));
      this.subscribeTo(this.selectionService.asObservable(), () => this.drawOverlays());
      this.subscribeTo(
        this.appModeService.asObservable(),
        () => {
          if (this.appMode === AppMode.SplitCommands
            || (this.appMode === AppMode.SplitSubPaths
              && this.activePathLayer
              && this.activePathLayer.isStroked())) {
            const subIdxs = new Set<number>();
            for (const s of this.selectionService.getSelections()) {
              subIdxs.add(s.subIdx);
            }
            const toArray = Array.from(subIdxs);
            const restrictToSubIdx = toArray.length ? toArray[0] : undefined;
            this.segmentSplitter = new SegmentSplitter(this, restrictToSubIdx);
          } else {
            this.segmentSplitter = undefined;
          }
          if (this.appMode === AppMode.Selection) {
            this.canvasSelector = new CanvasSelector(this);
          } else {
            this.canvasSelector = undefined;
          }
          if (this.appMode === AppMode.SplitSubPaths
            && this.activePathLayer
            && this.activePathLayer.isFilled()) {
            this.shapeSplitter = new ShapeSplitter(this);
          } else {
            this.shapeSplitter = undefined;
          }
          if (this.appMode !== AppMode.SplitCommands) {
            this.selectionService.reset();
          }
          if (!this.activePathId) {
            this.showPointerCursor();
          }
          this.hoverService.reset();
          this.resetCursor();
          this.currentHoverPreviewPath = undefined;
          this.draw();
        });
      const updateCurrentHoverFn = (hover: Hover | undefined) => {
        let previewPath: Path = undefined;
        if (this.shouldDrawLayers && hover) {
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
            case HoverType.Reverse:
              previewPath = mutator.reverseSubPath(subIdx).build();
              break;
            case HoverType.ShiftForward:
              previewPath = mutator.shiftSubPathForward(subIdx).build();
              break;
            case HoverType.ShiftBack:
              previewPath = mutator.shiftSubPathBack(subIdx).build();
              break;
          }
        }
        this.currentHoverPreviewPath = previewPath;
        this.drawOverlays();
      };
      this.subscribeTo(
        this.hoverService.asObservable(),
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
        });
    }
    this.resizeAndDraw();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private subscribeTo<T>(
    observable: Observable<T>,
    callbackFn: (t?: T) => void = () => this.draw()) {

    this.subscriptions.push(observable.subscribe(callbackFn));
  }

  /**
   * The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
   */
  private get attrScale() {
    return this.cssScale * devicePixelRatio;
  }

  /**
   * The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
   */
  private get cssScale() {
    const { width: vlWidth, height: vlHeight } = this.vlSize;
    const vectorAspectRatio = vlWidth / vlHeight;
    const containerAspectRatio = this.cssContainerWidth / this.cssContainerHeight;
    if (vectorAspectRatio > containerAspectRatio) {
      return this.cssContainerWidth / vlWidth;
    } else {
      return this.cssContainerHeight / vlHeight;
    }
  }

  get vectorLayer() {
    return this.stateService.getVectorLayer(this.canvasType);
  }

  private get activePathId() {
    return this.stateService.getActivePathId(this.canvasType);
  }

  get activePathLayer() {
    return this.activePathId
      ? this.stateService.getActivePathLayer(this.canvasType)
      : undefined;
  }

  get activePath() {
    return this.activePathId
      ? this.stateService.getActivePathLayer(this.canvasType).pathData
      : undefined;
  }

  private get shouldDrawLayers() {
    return this.vectorLayer && this.activePathId;
  }

  private get currentHover() {
    return this.hoverService.getHover();
  }

  private get appMode() {
    return this.appModeService.getAppMode();
  }

  private get shouldDisableLayer() {
    return this.canvasType === CanvasType.Preview
      && this.stateService.getMorphStatus() !== MorphStatus.Morphable;
  }

  private get shouldLabelPoints() {
    return this.canvasType !== CanvasType.Preview
      || this.settingsService.shouldLabelPoints();
  }

  private get shouldProcessMouseEvents() {
    return this.canvasType !== CanvasType.Preview && this.activePathId;
  }

  private get transformsForActiveLayer() {
    return LayerUtil.getTransformsForLayer(this.vectorLayer, this.activePathId);
  }

  private get smallPointRadius() {
    return SMALL_POINT_RADIUS / this.cssScale;
  }

  private get mediumPointRadius() {
    return MEDIUM_POINT_RADIUS / this.cssScale;
  }

  private get highlightLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale;
  }

  private get selectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 2;
  }

  private get unselectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 3;
  }

  private get lineDashLength() {
    return DASH_SIZE / this.cssScale;
  }

  private get minSnapThreshold() {
    return MIN_SNAP_THRESHOLD / this.cssScale;
  }

  get dragTriggerTouchSlop() {
    return DRAG_TRIGGER_TOUCH_SLOP / this.cssScale;
  }

  // Takes a path point and transforms it so that its coordinates are in terms
  // of the VectorLayer's viewport coordinates.
  private applyGroupTransforms(mousePoint: Point) {
    return MathUtil.transformPoint(
      mousePoint,
      Matrix.flatten(...this.transformsForActiveLayer.reverse()));
  }

  showPointerCursor() {
    this.canvasContainer.css({ cursor: 'pointer' });
  }

  resetCursor() {
    this.canvasContainer.css({ cursor: '' });
  }

  performHitTest(mousePoint: Point, opts: HitTestOpts = {}) {
    const transformMatrix =
      Matrix.flatten(...this.transformsForActiveLayer.reverse()).invert();
    const transformedMousePoint = MathUtil.transformPoint(mousePoint, transformMatrix);
    let isPointInRangeFn: (distance: number, cmd: Command) => boolean;
    if (!opts.noPoints) {
      isPointInRangeFn = (distance, cmd) => {
        const multiplyFactor = cmd.isSplit() ? SPLIT_POINT_RADIUS_FACTOR : 1;
        return distance <= this.mediumPointRadius * multiplyFactor;
      };
    }
    let isSegmentInRangeFn: (distance: number, cmd: Command) => boolean;
    if (!opts.noSegments) {
      isSegmentInRangeFn = distance => {
        let maxDistance = this.minSnapThreshold;
        if (this.activePathLayer.isStroked()) {
          maxDistance = Math.max(maxDistance, this.activePathLayer.strokeWidth / 2);
        }
        return distance <= maxDistance;
      };
    }
    const findShapesInRange = this.activePathLayer.isFilled() && !opts.noShapes;
    const restrictToSubIdx = opts.restrictToSubIdx;
    return this.activePath.hitTest(transformedMousePoint, {
      isPointInRangeFn,
      isSegmentInRangeFn,
      findShapesInRange,
      restrictToSubIdx,
    });
  }

  /**
   * Resizes the canvas and redraws all content.
   */
  private resizeAndDraw() {
    if (!this.isViewInit) {
      return;
    }
    const canvases = [
      this.canvasContainer,
      this.renderingCanvas,
      this.overlayCanvas,
      this.offscreenLayerCanvas,
      this.offscreenSubPathCanvas,
    ];
    const { width: vlWidth, height: vlHeight } = this.vlSize;
    canvases.forEach(canvas => {
      canvas
        .attr({
          width: vlWidth * this.attrScale,
          height: vlHeight * this.attrScale,
        })
        .css({
          width: vlWidth * this.cssScale,
          height: vlHeight * this.cssScale,
        });
    });
    this.draw();
    this.canvasRulers.forEach(r => r.draw());
  }

  /**
   * Redraws all content.
   */
  draw() {
    if (!this.isViewInit) {
      return;
    }

    this.renderingCtx.save();
    this.setupCtxWithViewportCoords(this.renderingCtx);

    const layerAlpha = this.vectorLayer ? this.vectorLayer.alpha : 1;
    const currentAlpha = (this.shouldDisableLayer ? DISABLED_ALPHA : 1) * layerAlpha;
    if (currentAlpha < 1) {
      this.offscreenLayerCtx.save();
      this.setupCtxWithViewportCoords(this.offscreenLayerCtx);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently w/o affecting the rest of
    // the layer's appearance.
    const layerCtx = currentAlpha < 1 ? this.offscreenLayerCtx : this.renderingCtx;
    if (this.shouldDrawLayers) {
      const hasDisabledSubPaths = !!this.disabledSubPathIndices.length;
      const subPathCtx = hasDisabledSubPaths ? this.offscreenSubPathCtx : layerCtx;
      if (hasDisabledSubPaths) {
        subPathCtx.save();
        this.setupCtxWithViewportCoords(subPathCtx);
      }

      // Draw any disabled subpaths.
      this.drawPaths(subPathCtx, layer => {
        if (layer.id !== this.activePathId) {
          return [];
        }
        return _.flatMap(layer.pathData.getSubPaths() as SubPath[],
          (subPath, subIdx) => {
            return this.disabledSubPathIndices.indexOf(subIdx) >= 0
              ? subPath.getCommands() as Command[] : [];
          });
      });
      if (hasDisabledSubPaths) {
        this.drawTranslucentOffscreenCtx(layerCtx, subPathCtx, DISABLED_ALPHA);
        subPathCtx.restore();
      }

      // Draw any enabled subpaths.
      this.drawPaths(layerCtx, layer => {
        if (layer.id !== this.activePathId) {
          return [];
        }
        return _.flatMap(layer.pathData.getSubPaths() as SubPath[],
          (subPath, subIdx) => {
            return this.disabledSubPathIndices.indexOf(subIdx) >= 0
              ? [] : subPath.getCommands() as Command[];
          });
      });
    }

    if (currentAlpha < 1) {
      this.drawTranslucentOffscreenCtx(
        this.renderingCtx, this.offscreenLayerCtx, currentAlpha);
      this.offscreenLayerCtx.restore();
    }
    this.renderingCtx.restore();

    this.drawOverlays();
  }

  // Scale the canvas so that everything from this point forward is drawn
  // in terms of the SVG's viewport coordinates.
  private setupCtxWithViewportCoords = (ctx: Context) => {
    ctx.scale(this.attrScale, this.attrScale);
    ctx.clearRect(0, 0, this.vlSize.width, this.vlSize.height);
  }

  private drawTranslucentOffscreenCtx(
    ctx: Context,
    offscreenCtx: Context,
    alpha: number) {

    ctx.save();
    ctx.globalAlpha = alpha;
    // Bring the canvas back to its original coordinates before
    // drawing the offscreen canvas contents.
    ctx.scale(1 / this.attrScale, 1 / this.attrScale);
    ctx.drawImage(offscreenCtx.canvas, 0, 0);
    ctx.restore();
  }

  // Draws any PathLayers to the canvas.
  private drawPaths(
    ctx: Context,
    extractDrawingCommandsFn: (layer: PathLayer) => ReadonlyArray<Command>,
  ) {
    this.vectorLayer.walk(layer => {
      if (layer instanceof ClipPathLayer) {
        // TODO: our SVG importer doesn't import clip paths... so this will never happen (yet)
        const transforms = LayerUtil.getTransformsForLayer(this.vectorLayer, layer.id);
        this.executeCommands(ctx, layer.pathData.getCommands(), transforms);
        ctx.clip();
        return;
      }
      if (!(layer instanceof PathLayer)) {
        return;
      }
      const commands = extractDrawingCommandsFn(layer);
      if (!commands.length) {
        return;
      }

      ctx.save();

      const transforms = LayerUtil.getTransformsForLayer(this.vectorLayer, layer.id);
      this.executeCommands(ctx, commands, transforms);

      // TODO: confirm this stroke multiplier thing works...
      const strokeWidthMultiplier = Matrix.flatten(...transforms).getScale();
      ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor, layer.strokeAlpha);
      ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
      ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor, layer.fillAlpha);
      ctx.lineCap = layer.strokeLinecap;
      ctx.lineJoin = layer.strokeLinejoin;
      ctx.miterLimit = layer.strokeMiterLimit;

      // TODO: update layer.pathData.length so that it reflects scale transforms
      if (layer.trimPathStart !== 0
        || layer.trimPathEnd !== 1
        || layer.trimPathOffset !== 0) {
        // Calculate the visible fraction of the trimmed path. If trimPathStart
        // is greater than trimPathEnd, then the result should be the combined
        // length of the two line segments: [trimPathStart,1] and [0,trimPathEnd].
        let shownFraction = layer.trimPathEnd - layer.trimPathStart;
        if (layer.trimPathStart > layer.trimPathEnd) {
          shownFraction += 1;
        }
        // Calculate the dash array. The first array element is the length of
        // the trimmed path and the second element is the gap, which is the
        // difference in length between the total path length and the visible
        // trimmed path length.
        ctx.setLineDash([
          shownFraction * layer.pathData.getPathLength(),
          (1 - shownFraction + 0.001) * layer.pathData.getPathLength()
        ]);
        // The amount to offset the path is equal to the trimPathStart plus
        // trimPathOffset. We mod the result because the trimmed path
        // should wrap around once it reaches 1.
        ctx.lineDashOffset = layer.pathData.getPathLength()
          * (1 - ((layer.trimPathStart + layer.trimPathOffset) % 1));
      } else {
        ctx.setLineDash([]);
      }
      if (layer.isStroked()
        && layer.strokeWidth
        && layer.trimPathStart !== layer.trimPathEnd) {
        ctx.stroke();
      }
      if (layer.isFilled()) {
        if (layer.fillType === 'evenOdd') {
          // Unlike VectorDrawables, SVGs spell 'evenodd' with a lowercase 'o'.
          ctx.fill('evenodd');
        } else {
          ctx.fill();
        }
      }
      ctx.restore();
    });
  }

  // Draw labeled points, highlights, selections, the pixel grid, etc.
  drawOverlays() {
    if (!this.isViewInit) {
      return;
    }
    this.overlayCtx.save();
    this.setupCtxWithViewportCoords(this.overlayCtx);
    if (this.shouldDrawLayers) {
      this.drawHighlights(this.overlayCtx);
      this.overlayCtx.restore();
      // Draw points in terms of physical pixels, not viewport pixels.
      this.overlayCtx.save();
      this.drawLabeledPoints(this.overlayCtx);
      this.drawSelectPointsDraggingPoints(this.overlayCtx);
      this.drawFloatingPreviewPoint(this.overlayCtx);
      this.drawFloatingSplitFilledPathPreviewPoints(this.overlayCtx);
    }
    this.overlayCtx.restore();

    // Note that the pixel grid is not drawn in viewport coordinates like above.
    if (this.cssScale > 4) {
      this.overlayCtx.save();
      this.overlayCtx.fillStyle = 'rgba(128, 128, 128, .25)';
      const devicePixelRatio = window.devicePixelRatio || 1;
      for (let x = 1; x < this.vlSize.width; x++) {
        this.overlayCtx.fillRect(
          x * this.attrScale - devicePixelRatio / 2,
          0,
          devicePixelRatio,
          this.vlSize.height * this.attrScale);
      }
      for (let y = 1; y < this.vlSize.height; y++) {
        this.overlayCtx.fillRect(
          0,
          y * this.attrScale - devicePixelRatio / 2,
          this.vlSize.width * this.attrScale,
          devicePixelRatio);
      }
      this.overlayCtx.restore();
    }
  }

  // Draw any highlighted subpaths.
  private drawHighlights(ctx: Context) {
    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }
    if (this.canvasSelector) {
      this.drawHighlightedSelectedSegments(ctx);
    } else if (this.segmentSplitter) {
      this.drawHighlightedAddPointModeSegments(ctx);
    }

    // Draw any existing split shape segments to the canvas.
    const cmds =
      _.chain(this.activePath.getSubPaths() as SubPath[])
        .filter(s => !s.isCollapsing())
        .flatMap(s => s.getCommands() as Command[])
        .filter(c => c.isSubPathSplitSegment())
        .value();
    this.executeCommands(ctx, cmds);
    this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.unselectedSegmentLineWidth);

    if (this.shapeSplitter) {
      this.drawSplitSubPathsModeDragSegment(ctx);
    }
  }

  private drawHighlightedSelectedSegments(ctx: Context) {
    const selectedSubIdxs: Set<number> = new Set<number>(
      this.selectionService.getSelections()
        .filter(s => s.type !== SelectionType.Segment)
        .map(s => s.subIdx));

    if (this.currentHover && this.currentHover.type !== HoverType.Segment) {
      selectedSubIdxs.add(this.currentHover.subIdx);
    }

    const subPaths = Array.from(selectedSubIdxs)
      .map(subIdx => this.activePath.getSubPath(subIdx))
      .filter(subPath => !subPath.isCollapsing());

    for (const subPath of subPaths) {
      const cmds = subPath.getCommands();
      const isSplitSubPath = cmds.some(c => c.isSubPathSplitSegment());
      const highlightColor = isSplitSubPath ? SPLIT_POINT_COLOR : HIGHLIGHT_COLOR;
      this.executeCommands(ctx, cmds);
      this.executeHighlights(ctx, highlightColor, this.selectedSegmentLineWidth);
    }
  }

  private drawHighlightedAddPointModeSegments(ctx: Context) {
    if (!this.segmentSplitter) {
      return;
    }
    const projectionOntoPath = this.segmentSplitter.getProjectionOntoPath();
    if (!projectionOntoPath) {
      return;
    }
    const { subIdx, cmdIdx, projection: { d } } = projectionOntoPath;
    const commands =
      d < this.minSnapThreshold
        ? [this.activePath.getCommand(subIdx, cmdIdx)]
        : this.activePath.getCommands();
    this.executeCommands(ctx, commands);
    this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
  }

  private drawSplitSubPathsModeDragSegment(ctx: Context) {
    if (!this.shapeSplitter) {
      return;
    }
    const proj1 = this.shapeSplitter.getInitialProjectionOntoPath();
    const proj2 = this.shapeSplitter.getFinalProjectionOntoPath();
    if (proj1) {
      // Draw a line from the starting projection to the final projection (or
      // to the last known mouse location, if one doesn't exist).
      const startPoint =
        this.applyGroupTransforms(new Point(proj1.projection.x, proj1.projection.y));
      const endPoint = proj2
        ? this.applyGroupTransforms(new Point(proj2.projection.x, proj2.projection.y))
        : this.shapeSplitter.getLastKnownMouseLocation();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.restore();
      this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
    }
    if (!proj1 || proj2) {
      // Highlight the segment as the user hovers over it.
      const projectionOntoPath = this.shapeSplitter.getCurrentProjectionOntoPath();
      if (projectionOntoPath) {
        const projection = projectionOntoPath.projection;
        if (projection && projection.d < this.minSnapThreshold) {
          const { subIdx, cmdIdx } = projectionOntoPath;
          const cmds = [this.activePath.getCommand(subIdx, cmdIdx)];
          this.executeCommands(ctx, cmds);
          this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
        }
      }
    }
  }

  // Draw any labeled points.
  private drawLabeledPoints(ctx: Context) {
    if (this.canvasType === CanvasType.Preview && !this.shouldLabelPoints) {
      return;
    }

    let path = this.activePath;
    if (this.currentHoverPreviewPath) {
      path = this.currentHoverPreviewPath;
    }

    interface PointInfo {
      cmd: Command;
      subIdx: number;
      cmdIdx: number;
    }

    const pathDataPointInfos: PointInfo[] =
      _.chain(path.getSubPaths() as SubPath[])
        .filter(subPath => !subPath.isCollapsing())
        .map((subPath, subIdx) => {
          return subPath.getCommands()
            .map((cmd, cmdIdx) => {
              return { cmd, subIdx, cmdIdx };
            });
        })
        .flatMap(pointInfos => pointInfos)
        .reverse()
        .value();

    const currSelections = this.selectionService.getSelections().map(sel => {
      return { type: sel.type, subIdx: sel.subIdx, cmdIdx: sel.cmdIdx };
    });
    const selectedSubPathIndices =
      _.flatMap(currSelections, sel => {
        return sel.type === SelectionType.SubPath ? [sel.subIdx] : [];
      });

    const isPointInfoSelectedFn = (pointInfo: PointInfo) => {
      const { subIdx, cmdIdx } = pointInfo;
      if (selectedSubPathIndices.indexOf(subIdx) >= 0) {
        return true;
      }
      return _.findIndex(currSelections, sel => {
        return sel.subIdx === subIdx;
      }) >= 0;
    };

    const removedSelectedCommands =
      _.remove(pathDataPointInfos, pointInfo => {
        const { subIdx, cmdIdx } = pointInfo;
        if (selectedSubPathIndices.indexOf(subIdx) >= 0) {
          return true;
        }
        return _.findIndex(currSelections, sel => {
          return sel.subIdx === subIdx && sel.cmdIdx === cmdIdx;
        }) >= 0;
      });
    pathDataPointInfos.push(
      ..._.remove(pathDataPointInfos, pointInfo => {
        return isPointInfoSelectedFn(pointInfo);
      }));
    pathDataPointInfos.push(...removedSelectedCommands);

    const isPointInfoHoveringFn = (pointInfo: PointInfo) => {
      const hover = this.currentHover;
      return hover && hover.type !== HoverType.Segment && pointInfo.subIdx === hover.subIdx;
    };

    const removedHoverCommands =
      _.remove(pathDataPointInfos, pointInfo => {
        const hover = this.currentHover;
        return hover
          && hover.type === HoverType.Point
          && pointInfo.subIdx === hover.subIdx
          && pointInfo.cmdIdx === hover.cmdIdx;
      });
    pathDataPointInfos.push(
      ..._.remove(pathDataPointInfos, pointInfo => {
        return isPointInfoHoveringFn(pointInfo);
      }));
    pathDataPointInfos.push(...removedHoverCommands);

    const draggedCommandIndex =
      this.canvasSelector && this.canvasSelector.isDragTriggered()
        ? this.canvasSelector.getDraggableSplitIndex()
        : undefined;
    for (const pointInfo of pathDataPointInfos) {
      const { cmd, subIdx, cmdIdx } = pointInfo;
      if (draggedCommandIndex
        && subIdx === draggedCommandIndex.subIdx
        && cmdIdx === draggedCommandIndex.cmdIdx) {
        // Skip the currently dragged point. We'll draw that next.
        continue;
      }
      let radius = this.smallPointRadius;
      let text: string = undefined;
      if (isPointInfoHoveringFn(pointInfo) || isPointInfoSelectedFn(pointInfo)) {
        radius = this.mediumPointRadius * SELECTED_POINT_RADIUS_FACTOR;
        if ((isPointInfoHoveringFn(pointInfo)
          && pointInfo.cmdIdx === this.currentHover.cmdIdx)
          || this.selectionService.isPointSelected(
            CanvasType.Start, pointInfo.subIdx, pointInfo.cmdIdx)
          || this.selectionService.isPointSelected(
            CanvasType.End, pointInfo.subIdx, pointInfo.cmdIdx)) {
          radius /= SPLIT_POINT_RADIUS_FACTOR;
        }
        text = (cmdIdx + 1).toString();
      }
      if (pointInfo.cmd.isSplit()) {
        radius *= SPLIT_POINT_RADIUS_FACTOR;
      }
      const color = cmd.isSplit() ? SPLIT_POINT_COLOR : NORMAL_POINT_COLOR;
      this.executeLabeledPoint(
        ctx, this.applyGroupTransforms(_.last(cmd.getPoints())), radius, color, text);
    }
  }

  // Draw any actively dragged points along the path (selection mode).
  private drawSelectPointsDraggingPoints(ctx: Context) {
    if (this.appMode !== AppMode.Selection
      || !this.canvasSelector
      || !this.canvasSelector.isDragTriggered()) {
      return;
    }
    const { x, y, d } = this.canvasSelector.getProjectionOntoPath().projection;
    const point =
      d < this.minSnapThreshold
        ? this.applyGroupTransforms(new Point(x, y))
        : this.canvasSelector.getLastKnownMouseLocation();
    this.executeLabeledPoint(
      ctx,
      point,
      this.mediumPointRadius *
      SPLIT_POINT_RADIUS_FACTOR, SPLIT_POINT_COLOR);
  }

  // Draw a floating point preview over the canvas (split commands mode
  // or split subpaths mode for stroked paths).
  private drawFloatingPreviewPoint(ctx: Context) {
    if (this.appMode !== AppMode.SplitCommands
      && this.appMode !== AppMode.SplitSubPaths
      && !this.activePathLayer.isStroked()
      || !this.segmentSplitter
      || !this.segmentSplitter.getProjectionOntoPath()) {
      return;
    }
    const { x, y, d } = this.segmentSplitter.getProjectionOntoPath().projection;
    if (d < this.minSnapThreshold) {
      this.executeLabeledPoint(
        ctx,
        this.applyGroupTransforms(new Point(x, y)),
        this.mediumPointRadius * SPLIT_POINT_RADIUS_FACTOR,
        SPLIT_POINT_COLOR);
    }
  }

  // Draw the floating points on top of the drag line in split filled subpath mode.
  private drawFloatingSplitFilledPathPreviewPoints(ctx: Context) {
    if (this.appMode !== AppMode.SplitSubPaths || !this.shapeSplitter) {
      return;
    }
    const proj1 = this.shapeSplitter.getInitialProjectionOntoPath();
    if (proj1) {
      const proj2 = this.shapeSplitter.getFinalProjectionOntoPath();
      this.executeLabeledPoint(
        ctx,
        this.applyGroupTransforms(new Point(proj1.projection.x, proj1.projection.y)),
        this.mediumPointRadius * SPLIT_POINT_RADIUS_FACTOR,
        SPLIT_POINT_COLOR);
      if (this.shapeSplitter.willFinalProjectionOntoPathCreateSplitPoint()) {
        const endPoint = proj2
          ? this.applyGroupTransforms(new Point(proj2.projection.x, proj2.projection.y))
          : this.shapeSplitter.getLastKnownMouseLocation();
        this.executeLabeledPoint(
          ctx,
          endPoint,
          this.mediumPointRadius * SPLIT_POINT_RADIUS_FACTOR,
          SPLIT_POINT_COLOR);
      }
    } else if (this.shapeSplitter.getCurrentProjectionOntoPath()) {
      const { x, y, d } = this.shapeSplitter.getCurrentProjectionOntoPath().projection;
      if (d < this.minSnapThreshold) {
        this.executeLabeledPoint(
          ctx,
          this.applyGroupTransforms(new Point(x, y)),
          this.mediumPointRadius * SPLIT_POINT_RADIUS_FACTOR,
          SPLIT_POINT_COLOR);
      }
    }
  }

  // MOUSE DOWN
  onMouseDown(event: MouseEvent) {
    this.showRuler(event);
    if (!this.shouldProcessMouseEvents) {
      return;
    }
    const mouseDown = this.mouseEventToPoint(event);
    if (this.appMode === AppMode.Selection) {
      this.canvasSelector.onMouseDown(mouseDown, event.shiftKey || event.metaKey);
    } else if (this.appMode === AppMode.SplitCommands) {
      this.segmentSplitter.onMouseDown(mouseDown);
    } else if (this.appMode === AppMode.SplitSubPaths) {
      if (this.activePathLayer.isStroked()) {
        this.segmentSplitter.onMouseDown(mouseDown);
      } else {
        this.shapeSplitter.onMouseDown(mouseDown);
      }
    }
  }

  // MOUSE MOVE
  onMouseMove(event: MouseEvent) {
    this.showRuler(event);
    if (!this.shouldProcessMouseEvents) {
      return;
    }
    const mouseMove = this.mouseEventToPoint(event);
    if (this.appMode === AppMode.Selection) {
      this.canvasSelector.onMouseMove(mouseMove);
    } else if (this.appMode === AppMode.SplitCommands) {
      this.segmentSplitter.onMouseMove(mouseMove);
    } else if (this.appMode === AppMode.SplitSubPaths) {
      if (this.activePathLayer.isStroked()) {
        this.segmentSplitter.onMouseMove(mouseMove);
      } else {
        this.shapeSplitter.onMouseMove(mouseMove);
      }
    }
  }

  // MOUSE UP
  onMouseUp(event: MouseEvent) {
    this.showRuler(event);
    if (!this.shouldProcessMouseEvents) {
      return;
    }
    const mouseUp = this.mouseEventToPoint(event);
    if (this.appMode === AppMode.Selection) {
      this.canvasSelector.onMouseUp(mouseUp, event.shiftKey || event.metaKey);
    } else if (this.appMode === AppMode.SplitCommands) {
      this.segmentSplitter.onMouseUp(mouseUp);
    } else if (this.appMode === AppMode.SplitSubPaths) {
      if (this.activePathLayer.isStroked()) {
        this.segmentSplitter.onMouseUp(mouseUp);
      } else {
        this.shapeSplitter.onMouseUp(mouseUp);
      }
    }
  }

  // MOUSE LEAVE
  onMouseLeave(event: MouseEvent) {
    this.canvasRulers.forEach(r => r.hideMouse());
    if (!this.shouldProcessMouseEvents) {
      return;
    }
    const mouseLeave = this.mouseEventToPoint(event);
    if (this.appMode === AppMode.Selection) {
      // TODO: how to handle the case where the mouse leaves and re-enters mid-gesture?
      this.canvasSelector.onMouseLeave(mouseLeave);
    } else if (this.appMode === AppMode.SplitCommands) {
      this.segmentSplitter.onMouseLeave(mouseLeave);
    } else if (this.appMode === AppMode.SplitSubPaths) {
      if (this.activePathLayer.isStroked()) {
        this.segmentSplitter.onMouseLeave(mouseLeave);
      } else {
        this.shapeSplitter.onMouseLeave(mouseLeave);
      }
    }
  }

  onClick(event: MouseEvent) {
    // TODO: is this hacky? should we be using onBlur() to reset the app mode?
    // This ensures that parents won't also receive the same click event.
    event.cancelBubble = true;

    if (this.activePathId) {
      return;
    }
    this.filePickerService.showFilePicker(this.canvasType);
  }

  /**
   * Converts a mouse point's CSS coordinates into vector layer viewport coordinates.
   */
  private mouseEventToPoint(event: MouseEvent) {
    const canvasOffset = this.canvasContainer.offset();
    const x = (event.pageX - canvasOffset.left) / this.cssScale;
    const y = (event.pageY - canvasOffset.top) / this.cssScale;
    return new Point(x, y);
  }

  private executeCommands(
    ctx: Context,
    commands: ReadonlyArray<Command>,
    transforms = this.transformsForActiveLayer) {

    ctx.save();
    transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));
    ctx.beginPath();

    if (commands.length === 1 && commands[0].getSvgChar() !== 'M') {
      ctx.moveTo(commands[0].getStart().x, commands[0].getStart().y);
    }

    let previousEndPoint: Point;
    commands.forEach(cmd => {
      const start = cmd.getStart();
      const end = cmd.getEnd();

      if (start && !start.equals(previousEndPoint)) {
        // This is to support the case where the list of commands
        // is size fragmented.
        ctx.moveTo(start.x, start.y);
      }

      if (cmd.getSvgChar() === 'M') {
        ctx.moveTo(end.x, end.y);
      } else if (cmd.getSvgChar() === 'L') {
        ctx.lineTo(end.x, end.y);
      } else if (cmd.getSvgChar() === 'Q') {
        ctx.quadraticCurveTo(
          cmd.getPoints()[1].x, cmd.getPoints()[1].y,
          cmd.getPoints()[2].x, cmd.getPoints()[2].y);
      } else if (cmd.getSvgChar() === 'C') {
        ctx.bezierCurveTo(
          cmd.getPoints()[1].x, cmd.getPoints()[1].y,
          cmd.getPoints()[2].x, cmd.getPoints()[2].y,
          cmd.getPoints()[3].x, cmd.getPoints()[3].y);
      } else if (cmd.getSvgChar() === 'Z') {
        if (start.equals(previousEndPoint)) {
          ctx.closePath();
        } else {
          // This is to support the case where the list of commands
          // is size fragmented.
          ctx.lineTo(end.x, end.y);
        }
      }
      previousEndPoint = end;
    });
    ctx.restore();
  }

  private executeHighlights(ctx: Context, color: string, lineWidth: number) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  // Draws a labeled point with optional text.
  private executeLabeledPoint(
    ctx: Context,
    point: Point,
    radius: number,
    color: string,
    text?: string) {

    // Convert the point and the radius to physical pixel coordinates.
    // We do this to avoid fractional font sizes less than 1px, which
    // show up OK on Chrome but not on Firefox or Safari.
    point = MathUtil.transformPoint(
      point, Matrix.fromScaling(this.attrScale, this.attrScale));
    radius *= this.attrScale;

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

  /**
   * Sends a signal that the canvas rulers should be redrawn.
   */
  private showRuler(event: MouseEvent) {
    const canvasOffset = this.canvasContainer.offset();
    const x = (event.pageX - canvasOffset.left) / Math.max(1, this.cssScale);
    const y = (event.pageY - canvasOffset.top) / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse(new Point(_.round(x), _.round(y))));
  }
}

interface HitTestOpts {
  noPoints?: boolean;
  noSegments?: boolean;
  noShapes?: boolean;
  restrictToSubIdx?: number[];
}
