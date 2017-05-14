import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  Input, ViewChildren, QueryList, ChangeDetectionStrategy
} from '@angular/core';
import { Path, Command } from '../scripts/paths';
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
  MorphSubPathService,
} from '../services';
import { OldCanvasRulerDirective } from './oldcanvasruler.directive';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { SegmentSplitter } from './SegmentSplitter';
import { SelectionHelper } from './SelectionHelper';
import { MorphSubPathHelper } from './MorphSubPathHelper';
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

const NORMAL_POINT_COLOR = '#2962FF'; // Blue A400
const SPLIT_POINT_COLOR = '#E65100'; // Orange 900
const HIGHLIGHT_COLOR = '#448AFF';
const POINT_BORDER_COLOR = '#000';
const POINT_TEXT_COLOR = '#fff';

type Context = CanvasRenderingContext2D;

@Component({
  selector: 'app-oldcanvas',
  templateUrl: './oldcanvas.component.html',
  styleUrls: ['./oldcanvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OldCanvasComponent implements AfterViewInit, OnDestroy {
  @Input() canvasType: CanvasType;
  @ViewChild('canvasContainer') private canvasContainerRef: ElementRef;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;
  @ViewChild('overlayCanvas') private overlayCanvasRef: ElementRef;
  @ViewChildren(OldCanvasRulerDirective) canvasRulers: QueryList<OldCanvasRulerDirective>;

  private canvasContainer: JQuery;
  private renderingCanvas: JQuery;
  private overlayCanvas: JQuery;
  private offscreenLayerCanvas: JQuery;
  private renderingCtx: Context;
  private overlayCtx: Context;
  private offscreenLayerCtx: Context;
  private isViewInit: boolean;
  private cssContainerWidth = 1;
  private cssContainerHeight = 1;
  private vlSize = { width: DEFAULT_VIEWPORT_SIZE, height: DEFAULT_VIEWPORT_SIZE };
  private currentHoverPreviewPath: Path;
  private selectionHelper: SelectionHelper | undefined;
  private morphSubPathHelper: MorphSubPathHelper | undefined;
  private segmentSplitter: SegmentSplitter | undefined;
  private shapeSplitter: ShapeSplitter | undefined;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    readonly elementRef: ElementRef,
    readonly appModeService: AppModeService,
    private readonly canvasResizeService: CanvasResizeService,
    readonly hoverService: HoverService,
    readonly stateService: StateService,
    readonly animatorService: AnimatorService,
    readonly selectionService: SelectionService,
    private readonly settingsService: SettingsService,
    readonly morphSubPathService: MorphSubPathService,
  ) { }

  ngAfterViewInit() {
    this.isViewInit = true;
    this.canvasContainer = $(this.canvasContainerRef.nativeElement);
    this.renderingCanvas = $(this.renderingCanvasRef.nativeElement);
    this.overlayCanvas = $(this.overlayCanvasRef.nativeElement);
    this.offscreenLayerCanvas = $(document.createElement('canvas'));
    const getCtxFn = (canvas: JQuery) => {
      return (canvas.get(0) as HTMLCanvasElement).getContext('2d');
    };
    this.renderingCtx = getCtxFn(this.renderingCanvas);
    this.overlayCtx = getCtxFn(this.overlayCanvas);
    this.offscreenLayerCtx = getCtxFn(this.offscreenLayerCanvas);
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
    this.subscribeTo(this.morphSubPathService.asObservable(), () => this.drawOverlays());
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
      // const interpolatePreviewFn = () => {
      //   const fraction = this.animatorService.getAnimatedValue();
      //   const startVl = this.stateService.getVectorLayer(CanvasType.Start);
      //   const previewVl = this.stateService.getVectorLayer(CanvasType.Preview);
      //   const endVl = this.stateService.getVectorLayer(CanvasType.End);
      //   if (startVl && previewVl && endVl
      //     && startVl.isMorphableWith(previewVl)
      //     && previewVl.isMorphableWith(endVl)) {
      //     LayerUtil.deepInterpolate(startVl, previewVl, endVl, fraction);
      //   }
      //   this.draw();
      // };
      // this.subscribeTo(
      //   this.stateService.getActivePathIdObservable(this.canvasType),
      //   () => interpolatePreviewFn());
      // this.subscribeTo(
      //   this.animatorService.getAnimatedValueObservable(),
      //   () => interpolatePreviewFn());
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
            this.segmentSplitter = new SegmentSplitter(this);
          } else {
            this.segmentSplitter = undefined;
          }
          if (this.appMode === AppMode.Selection) {
            this.selectionHelper = new SelectionHelper(this);
          } else {
            this.selectionHelper = undefined;
          }
          if (this.appMode === AppMode.MorphSubPaths) {
            this.morphSubPathHelper = new MorphSubPathHelper(this);
            this.morphSubPathService.reset();
            const selections = this.selectionService.getSubPathSelections();
            if (selections.length) {
              const { source, subIdx } = selections[0];
              this.morphSubPathService.setUnpairedSubPath({ source, subIdx });
            }
          } else {
            this.morphSubPathHelper = undefined;
          }
          if (this.appMode === AppMode.SplitSubPaths
            && this.activePathLayer
            && this.activePathLayer.isFilled()) {
            this.shapeSplitter = new ShapeSplitter(this);
          } else {
            this.shapeSplitter = undefined;
          }
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

  private get splitPointRadius() {
    return this.mediumPointRadius * SPLIT_POINT_RADIUS_FACTOR;
  }

  private get highlightLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale;
  }

  private get selectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 1.9;
  }

  private get unselectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 3;
  }

  private get minSnapThreshold() {
    return MIN_SNAP_THRESHOLD / this.cssScale;
  }

  get dragTriggerTouchSlop() {
    return DRAG_TRIGGER_TOUCH_SLOP / this.cssScale;
  }

  performHitTest(mousePoint: Point, opts: HitTestOpts = {}) {
    const transformMatrix =
      Matrix.flatten(...this.transformsForActiveLayer.reverse()).invert();
    const transformedMousePoint = MathUtil.transformPoint(mousePoint, transformMatrix);
    let isPointInRangeFn: (distance: number, cmd: Command) => boolean;
    if (!opts.noPoints) {
      isPointInRangeFn = (distance, cmd) => {
        const multiplyFactor = cmd.isSplitPoint() ? SPLIT_POINT_RADIUS_FACTOR : 1;
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
    return this.activePath.hitTest(
      transformedMousePoint, {
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
      // TODO: display non-active paths as well?
      this.drawPaths(layerCtx, layer => {
        return layer.name === this.activePathId ? layer.pathData.getCommands() : [];
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
        const transforms = LayerUtil.getTransformsForLayer(this.vectorLayer, layer.name);
        executeCommands(ctx, layer.pathData.getCommands(), transforms);
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

      const transforms = LayerUtil.getTransformsForLayer(this.vectorLayer, layer.name);
      executeCommands(ctx, commands, transforms);

      // TODO: confirm this stroke multiplier thing works...
      const strokeWidthMultiplier = Matrix.flatten(...transforms).getScale();
      ctx.strokeStyle = ColorUtil.androidToCssRgbaColor(layer.strokeColor, layer.strokeAlpha);
      ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
      ctx.fillStyle = ColorUtil.androidToCssRgbaColor(layer.fillColor, layer.fillAlpha);
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
          (1 - shownFraction + 0.001) * layer.pathData.getPathLength(),
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
      this.drawDraggingPoints(this.overlayCtx);
      this.drawFloatingPreviewPoint(this.overlayCtx);
      this.drawFloatingSplitFilledPathPreviewPoints(this.overlayCtx);
    }
    this.overlayCtx.restore();

    // Draw the pixel grid in terms of physical pixels, not viewport pixels.
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

  // Draw any highlighted segments.
  private drawHighlights(ctx: Context) {
    if (this.canvasType === CanvasType.Preview) {
      return;
    }
    const transforms = this.transformsForActiveLayer;
    if (this.selectionHelper) {
      // Draw any highlighted subpaths. We'll highlight a subpath if a subpath
      // selection or a point selection exists.
      const selectedSubPaths =
        _.chain(this.selectionService.getSelections())
          .filter(s => {
            return s.source === this.canvasType
              && (s.type === SelectionType.Point
                || s.type === SelectionType.SubPath);
          })
          .map(s => s.subIdx)
          .uniq()
          .map(subIdx => this.activePath.getSubPath(subIdx))
          .filter(subPath => !subPath.isCollapsing())
          .value();

      for (const subPath of selectedSubPaths) {
        // If the subpath has a split segment, highlight it in orange. Otherwise,
        // use the default blue highlight color.
        const cmds = subPath.getCommands();
        const isSplitSubPath = cmds.some(c => c.isSplitSegment());
        const highlightColor = isSplitSubPath ? SPLIT_POINT_COLOR : HIGHLIGHT_COLOR;
        executeCommands(ctx, cmds, transforms);
        this.executeHighlights(ctx, highlightColor, this.selectedSegmentLineWidth);
      }

      const segmentSelections =
        this.selectionService.getSegmentSelections()
          .filter(s => s.source === this.canvasType)
          .map(s => { return { subIdx: s.subIdx, cmdIdx: s.cmdIdx }; });
      const hover = this.currentHover;
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
          .map(s => this.activePath.getCommand(s.subIdx, s.cmdIdx))
          .filter(cmd => cmd.isSplitSegment());
      executeCommands(ctx, segmentSelectionCmds, transforms);
      this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
    } else if (this.segmentSplitter && this.segmentSplitter.getProjectionOntoPath()) {
      // Highlight the segment as the user hovers over it.
      const { subIdx, cmdIdx, projection: { d } } =
        this.segmentSplitter.getProjectionOntoPath();
      if (d < this.minSnapThreshold) {
        executeCommands(ctx, [this.activePath.getCommand(subIdx, cmdIdx)], transforms);
        this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
      }
    }

    // Draw any existing split shape segments to the canvas.
    const cmds =
      _.chain(this.activePath.getSubPaths())
        .filter(s => !s.isCollapsing())
        .flatMap(s => s.getCommands() as Command[])
        .filter(c => c.isSplitSegment())
        .value();
    executeCommands(ctx, cmds, transforms);
    this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.unselectedSegmentLineWidth);

    if (this.morphSubPathHelper) {
      const currUnpair = this.morphSubPathService.getUnpairedSubPath();
      if (currUnpair) {
        // Draw the current unpaired subpath in orange, if it exists.
        const { source, subIdx } = currUnpair;
        const subPath = this.activePath.getSubPath(subIdx);
        if (source === this.canvasType) {
          executeCommands(ctx, subPath.getCommands(), transforms);
          this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
        }
      }
      const pairedSubPaths = this.morphSubPathService.getPairedSubPaths();
      const hasHover =
        this.currentHover
        && this.currentHover.source === this.canvasType
        && this.currentHover.type === HoverType.SubPath;
      if (hasHover) {
        pairedSubPaths.delete(this.currentHover.subIdx);
      }
      if (pairedSubPaths.size) {
        // Draw any already paired subpaths in blue.
        const pairedCmds =
          _.flatMap(
            Array.from(pairedSubPaths),
            subIdx => this.activePath.getSubPath(subIdx).getCommands() as Command[]);
        executeCommands(ctx, pairedCmds, transforms);
        this.executeHighlights(ctx, NORMAL_POINT_COLOR, this.selectedSegmentLineWidth);
      }
      if (hasHover) {
        // Highlight the hover in orange, if it exists.
        const hoverCmds = this.activePath.getSubPath(this.currentHover.subIdx).getCommands();
        executeCommands(ctx, hoverCmds, transforms);
        this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
      }
    } else if (this.shapeSplitter) {
      // If we are splitting a filled subpath, draw the in progress drag segment.
      const proj1 = this.shapeSplitter.getInitialProjectionOntoPath();
      const proj2 = this.shapeSplitter.getFinalProjectionOntoPath();
      if (proj1) {
        // Draw a line from the starting projection to the final projection (or
        // to the last known mouse location, if one doesn't exist).
        const startPoint =
          applyGroupTransforms(new Point(proj1.projection.x, proj1.projection.y), transforms);
        const endPoint = proj2
          ? applyGroupTransforms(new Point(proj2.projection.x, proj2.projection.y), transforms)
          : this.shapeSplitter.getLastKnownMouseLocation();
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
      }
      if (!proj1 || proj2) {
        // Highlight the segment as the user hovers over it.
        const projectionOntoPath = this.shapeSplitter.getCurrentProjectionOntoPath();
        if (projectionOntoPath) {
          const projection = projectionOntoPath.projection;
          if (projection && projection.d < this.minSnapThreshold) {
            const { subIdx, cmdIdx } = projectionOntoPath;
            executeCommands(ctx, [this.activePath.getCommand(subIdx, cmdIdx)], transforms);
            this.executeHighlights(ctx, SPLIT_POINT_COLOR, this.selectedSegmentLineWidth);
          }
        }
      }
    }
  }

  // Draw any labeled points.
  private drawLabeledPoints(ctx: Context) {
    if (this.canvasType === CanvasType.Preview && !this.shouldLabelPoints) {
      // Only draw points on the preview canvas if the user has enabled the setting.
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

    const subPathSelections = this.selectionService.getSubPathSelections();
    const pointSelections = this.selectionService.getPointSelections();

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

    // Remove a hovering point, if one exists.
    const hoveringPointInfos =
      _.remove(pointInfos, ({ subIdx, cmdIdx }: PointInfo) => {
        const hover = this.currentHover;
        return hover
          && hover.type === HoverType.Point
          && hover.subIdx === subIdx
          && hover.cmdIdx === cmdIdx;
      });
    // Remove any subpath points that share the same subIdx as an existing hover.
    const isPointInfoHoveringFn = ({ subIdx }: PointInfo) => {
      const hover = this.currentHover;
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
    const transforms = this.transformsForActiveLayer;
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
      if ((isAtLeastMedium || isHovering) && this.appMode === AppMode.Selection) {
        radius = this.mediumPointRadius * SELECTED_POINT_RADIUS_FACTOR;
        const isPointEnlargedFn = (source: CanvasType, sIdx: number, cIdx: number) => {
          return pointSelections.some(s => {
            return s.subIdx === sIdx && s.cmdIdx === cIdx && s.source === source;
          });
        };
        if ((isHovering && cmdIdx === this.currentHover.cmdIdx)
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
      this.executeLabeledPoint(
        ctx, applyGroupTransforms(_.last(cmd.getPoints()), transforms), radius, color, text);
    }
  }

  // Draw any actively dragged points along the path in selection mode.
  private drawDraggingPoints(ctx: Context) {
    if (this.appMode !== AppMode.Selection
      || !this.selectionHelper
      || !this.selectionHelper.isDragTriggered()) {
      return;
    }
    const { x, y, d } = this.selectionHelper.getProjectionOntoPath().projection;
    const point =
      d < this.minSnapThreshold
        ? applyGroupTransforms(new Point(x, y), this.transformsForActiveLayer)
        : this.selectionHelper.getLastKnownMouseLocation();
    this.executeLabeledPoint(
      ctx,
      point,
      this.splitPointRadius,
      SPLIT_POINT_COLOR);
  }

  // Draw a floating point preview over the canvas in split commands mode
  // and split subpaths mode for stroked paths.
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
        applyGroupTransforms(new Point(x, y), this.transformsForActiveLayer),
        this.splitPointRadius,
        SPLIT_POINT_COLOR);
    }
  }

  // Draw the floating points on top of the drag line in split filled subpath mode.
  private drawFloatingSplitFilledPathPreviewPoints(ctx: Context) {
    if (this.appMode !== AppMode.SplitSubPaths || !this.shapeSplitter) {
      return;
    }
    const transforms = this.transformsForActiveLayer;
    const proj1 = this.shapeSplitter.getInitialProjectionOntoPath();
    if (proj1) {
      const proj2 = this.shapeSplitter.getFinalProjectionOntoPath();
      this.executeLabeledPoint(
        ctx,
        applyGroupTransforms(new Point(proj1.projection.x, proj1.projection.y), transforms),
        this.splitPointRadius,
        SPLIT_POINT_COLOR);
      if (this.shapeSplitter.willFinalProjectionOntoPathCreateSplitPoint()) {
        const endPoint = proj2
          ? applyGroupTransforms(new Point(proj2.projection.x, proj2.projection.y), transforms)
          : this.shapeSplitter.getLastKnownMouseLocation();
        this.executeLabeledPoint(
          ctx,
          endPoint,
          this.splitPointRadius,
          SPLIT_POINT_COLOR);
      }
    } else if (this.shapeSplitter.getCurrentProjectionOntoPath()) {
      const { x, y, d } = this.shapeSplitter.getCurrentProjectionOntoPath().projection;
      if (d < this.minSnapThreshold) {
        this.executeLabeledPoint(
          ctx,
          applyGroupTransforms(new Point(x, y), transforms),
          this.splitPointRadius,
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
      this.selectionHelper.onMouseDown(mouseDown, event.shiftKey || event.metaKey);
    } else if (this.appMode === AppMode.MorphSubPaths) {
      this.morphSubPathHelper.onMouseDown(mouseDown, event.shiftKey || event.metaKey);
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
      this.selectionHelper.onMouseMove(mouseMove);
    } else if (this.appMode === AppMode.MorphSubPaths) {
      this.morphSubPathHelper.onMouseMove(mouseMove);
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
      this.selectionHelper.onMouseUp(mouseUp, event.shiftKey || event.metaKey);
    } else if (this.appMode === AppMode.MorphSubPaths) {
      this.morphSubPathHelper.onMouseUp(mouseUp);
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
      this.selectionHelper.onMouseLeave(mouseLeave);
    } else if (this.appMode === AppMode.MorphSubPaths) {
      this.morphSubPathHelper.onMouseLeave(mouseLeave);
    } else if (this.appMode === AppMode.SplitCommands) {
      this.segmentSplitter.onMouseLeave(mouseLeave);
    } else if (this.appMode === AppMode.SplitSubPaths) {
      if (this.activePathLayer.isStroked()) {
        this.segmentSplitter.onMouseLeave(mouseLeave);
      } else {
        this.shapeSplitter.onMouseLeave(mouseLeave);
      }
    }
    this.hoverService.resetAndNotify();
  }

  onClick(event: MouseEvent) {
    // TODO: re-enable click canvas to import file?

    // TODO: is this hacky? should we be using onBlur() to reset the app mode?
    // This ensures that parents won't also receive the same click event.
    event.cancelBubble = true;
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

// Takes a path point and transforms it so that its coordinates are in terms
// of the VectorLayer's viewport coordinates.
function applyGroupTransforms(mousePoint: Point, transforms: Matrix[]) {
  return MathUtil.transformPoint(
    mousePoint,
    Matrix.flatten(...transforms.slice().reverse()));
}

function executeCommands(
  ctx: Context,
  commands: ReadonlyArray<Command>,
  transforms: Matrix[]) {

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

interface HitTestOpts {
  noPoints?: boolean;
  noSegments?: boolean;
  noShapes?: boolean;
  restrictToSubIdx?: number[];
}
