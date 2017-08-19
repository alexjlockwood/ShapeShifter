import { ToolMode } from 'app/model/toolMode';
import * as $ from 'jquery';
import * as paper from 'paper';

// TODO: make use of the clipboard somehow?
const clipboard = undefined;

let selectionBounds = undefined;
let selectionBoundsShape = undefined;
let drawSelectionBounds = 0;

const oppositeCorner = {
  'top-left': 'bottom-right',
  'top-center': 'bottom-center',
  'top-right': 'bottom-left',
  'right-center': 'left-center',
  'bottom-right': 'top-left',
  'bottom-center': 'top-center',
  'bottom-left': 'top-right',
  'left-center': 'right-center',
};

interface CommonTool {
  resetHot(type: string, event: paper.ToolEvent, mode: string): void;
  testHot(type: string, event: paper.ToolEvent, mode: string): boolean;
  hitTest(event: paper.ToolEvent): boolean;
}

export class ToolStack extends paper.Tool {
  private stack: ReadonlyArray<CommonTool>;
  private mode: string;
  private hotTool: any;
  private activeTool: any;
  private lastPoint = new paper.Point(0, 0);

  constructor() {
    super();
    this.stack = [
      new SelectTool(),
      new DirectSelectTool(),
      new ScaleTool(),
      new RotateTool(),
      new PenTool(this),
      new ZoomPanTool(),
    ];
    this.on({
      activate: () => {
        this.activeTool = undefined;
        this.hotTool = undefined;
      },
      deactivate: () => {
        this.activeTool = undefined;
        this.hotTool = undefined;
      },
      mousedown: (event: paper.ToolEvent) => {
        this.lastPoint = event.point.clone();
        if (this.hotTool) {
          this.activeTool = this.hotTool;
          this.activeTool.fire('mousedown', event);
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        this.lastPoint = event.point.clone();
        if (this.activeTool) {
          this.activeTool.fire('mouseup', event);
        }
        this.activeTool = undefined;
        this.testHot('mouseup', event);
      },
      mousedrag: (event: paper.ToolEvent) => {
        this.lastPoint = event.point.clone();
        if (this.activeTool) {
          this.activeTool.fire('mousedrag', event);
        }
      },
      mousemove: (event: paper.ToolEvent) => {
        this.lastPoint = event.point.clone();
        this.testHot('mousemove', event);
      },
      keydown: (event: paper.ToolEvent) => {
        event.point = this.lastPoint.clone();
        if (this.activeTool) {
          this.activeTool.fire('keydown', event);
        } else {
          this.testHot('keydown', event);
        }
      },
      keyup: (event: paper.ToolEvent) => {
        event.point = this.lastPoint.clone();
        if (this.activeTool) {
          this.activeTool.fire('keyup', event);
        } else {
          this.testHot('keyup', event);
        }
      },
    });
  }

  getToolMode() {
    return this.mode;
  }

  setToolMode(mode: string) {
    this.mode = mode;
    const event = new paper.Event();
    (event as any).point = this.lastPoint.clone();
    this.testHot('mode', event as paper.ToolEvent);
  }

  private testHot(type: string, event: paper.ToolEvent) {
    // Reset the state of the tool before testing.
    const prev = this.hotTool;
    this.hotTool = undefined;
    for (const s of this.stack) {
      s.resetHot(type, event, this.mode);
    }
    // Pick the first hot tool.
    for (const s of this.stack) {
      if (s.testHot(type, event, this.mode)) {
        this.hotTool = s;
        break;
      }
    }
    if (prev !== this.hotTool) {
      if (prev) {
        prev.fire('deactivate');
      }
      if (this.hotTool) {
        this.hotTool.fire('activate');
      }
    }
  }
}

class SelectTool extends paper.Tool implements CommonTool {
  private mouseStartPos = new paper.Point(0, 0);
  private mode: string;
  private hitResult: paper.HitResult;
  private originalContent: any[];
  private changed = false;
  private duplicates: any[];

  constructor() {
    super();

    this.on({
      activate: () => {
        setCanvasCursor('cursor-arrow-black');
        updateSelectionState();
        showSelectionBounds();
      },
      deactivate: () => hideSelectionBounds(),
      mousedown: (event: paper.ToolEvent) => {
        this.mode = undefined;
        this.changed = false;

        if (this.hitResult) {
          if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
            if (event.modifiers.shift) {
              this.hitResult.item.selected = !this.hitResult.item.selected;
            } else {
              if (!this.hitResult.item.selected) {
                deselectAll();
              }
              this.hitResult.item.selected = true;
            }
            if (this.hitResult.item.selected) {
              this.mode = 'move-shapes';
              deselectAllPoints();
              this.mouseStartPos = event.point.clone();
              this.originalContent = captureSelectionState();
            }
          }
          updateSelectionState();
        } else {
          // Clicked on and empty area, engage box select.
          this.mouseStartPos = event.point.clone();
          this.mode = 'box-select';
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        if (this.mode === 'move-shapes') {
          if (this.changed) {
            clearSelectionBounds();
            // undo.snapshot('Move Shapes');
          }
          this.duplicates = undefined;
        } else if (this.mode === 'box-select') {
          const box = new paper.Rectangle(this.mouseStartPos, event.point);

          if (!event.modifiers.shift) {
            deselectAll();
          }

          const selectedPaths = getPathsIntersectingRect(box);
          for (const path of selectedPaths) {
            path.selected = !path.selected;
          }
        }

        updateSelectionState();

        if (this.hitResult) {
          if (this.hitResult.item.selected) {
            setCanvasCursor('cursor-arrow-small');
          } else {
            setCanvasCursor('cursor-arrow-black-shape');
          }
        }
      },
      mousedrag: (event: paper.ToolEvent) => {
        if (this.mode === 'move-shapes') {
          this.changed = true;

          if (event.modifiers.option) {
            if (this.duplicates === undefined) {
              this.createDuplicates(this.originalContent);
            }
            setCanvasCursor('cursor-arrow-duplicate');
          } else {
            if (this.duplicates) {
              this.removeDuplicates();
            }
            setCanvasCursor('cursor-arrow-small');
          }

          let delta = event.point.subtract(this.mouseStartPos);
          if (event.modifiers.shift) {
            delta = snapDeltaToAngle(delta, Math.PI * 2 / 8);
          }

          restoreSelectionState(this.originalContent);

          const selected = (paper.project as any).selectedItems;
          for (const item of selected) {
            item.position = item.position.add(delta);
          }
          updateSelectionState();
        } else if (this.mode === 'box-select') {
          dragRect(this.mouseStartPos, event.point);
        }
      },
      mousemove: (event: paper.ToolEvent) => this.hitTest(event),
    });
  }

  private createDuplicates(content) {
    this.duplicates = [];
    for (const orig of content) {
      const item: any = paper.project.importJSON(orig.json);
      if (item) {
        item.selected = false;
        this.duplicates.push(item);
      }
    }
  }

  private removeDuplicates() {
    for (const dup of this.duplicates) {
      dup.remove();
    }
    this.duplicates = undefined;
  }

  resetHot(type: string, event: paper.ToolEvent, mode: string) {}

  testHot(type: string, event: paper.ToolEvent, mode: string) {
    return this.hitTest(event);
  }

  hitTest(event: paper.ToolEvent) {
    const hitSize = 4;
    this.hitResult = undefined;

    // Hit test items.
    if (event.point) {
      this.hitResult = paper.project.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    if (this.hitResult) {
      if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
        if (this.hitResult.item.selected) {
          setCanvasCursor('cursor-arrow-small');
        } else {
          setCanvasCursor('cursor-arrow-black-shape');
        }
      }
    } else {
      setCanvasCursor('cursor-arrow-black');
    }

    return true;
  }
}

class DirectSelectTool extends paper.Tool implements CommonTool {
  private mouseStartPos = new paper.Point(0, 0);
  private mode: string;
  private hitResult: paper.HitResult;
  private originalContent?: any; // Array of objects?
  private changed = false;
  private duplicates: any[]; // Array of objects?
  private originalHandleIn: paper.Point;
  private originalHandleOut: paper.Point;

  constructor() {
    super();

    this.on({
      activate: () => {
        setCanvasCursor('cursor-arrow-white');
      },
      deactivate: () => {},
      mousedown: (event: paper.ToolEvent) => {
        this.mode = undefined;
        this.changed = false;

        if (this.hitResult) {
          if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
            if (event.modifiers.shift) {
              this.hitResult.item.selected = !this.hitResult.item.selected;
            } else {
              if (!this.hitResult.item.selected) {
                deselectAll();
              }
              this.hitResult.item.selected = true;
            }
            if (this.hitResult.item.selected) {
              this.mode = 'move-shapes';
              deselectAllPoints();
              this.mouseStartPos = event.point.clone();
              this.originalContent = captureSelectionState();
            }
          } else if (this.hitResult.type === 'segment') {
            if (event.modifiers.shift) {
              this.hitResult.segment.selected = !this.hitResult.segment.selected;
            } else {
              if (!this.hitResult.segment.selected) {
                deselectAllPoints();
              }
              this.hitResult.segment.selected = true;
            }
            if (this.hitResult.segment.selected) {
              this.mode = 'move-points';
              this.mouseStartPos = event.point.clone();
              this.originalContent = captureSelectionState();
            }
          } else if (this.hitResult.type === 'handle-in' || this.hitResult.type === 'handle-out') {
            this.mode = 'move-handle';
            this.mouseStartPos = event.point.clone();
            this.originalHandleIn = this.hitResult.segment.handleIn.clone();
            this.originalHandleOut = this.hitResult.segment.handleOut.clone();

            /*				if (this.hitResult.type ==='handle-out') {
            this.originalHandlePos = this.hitResult.segment.handleOut.clone();
            this.originalOppHandleLength = this.hitResult.segment.handleIn.length;
          } else {
            this.originalHandlePos = this.hitResult.segment.handleIn.clone();
            this.originalOppHandleLength = this.hitResult.segment.handleOut.length;
          }*/
            // this.originalContent = captureSelectionState(); // For some reason this does not work!
          }
          updateSelectionState();
        } else {
          // Clicked on and empty area, engage box select.
          this.mouseStartPos = event.point.clone();
          this.mode = 'box-select';
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        if (this.mode === 'move-shapes') {
          if (this.changed) {
            clearSelectionBounds();
            // undo.snapshot('Move Shapes');
          }
        } else if (this.mode === 'move-points') {
          if (this.changed) {
            clearSelectionBounds();
            // undo.snapshot('Move Points');
          }
        } else if (this.mode === 'move-handle') {
          if (this.changed) {
            clearSelectionBounds();
            // undo.snapshot('Move Handle');
          }
        } else if (this.mode === 'box-select') {
          const box = new paper.Rectangle(this.mouseStartPos, event.point);

          if (!event.modifiers.shift) {
            deselectAll();
          }

          const selectedSegments = getSegmentsInRect(box);
          if (selectedSegments.length > 0) {
            for (const segment of selectedSegments) {
              segment.selected = !segment.selected;
            }
          } else {
            const selectedPaths = getPathsIntersectingRect(box);
            for (const path of selectedPaths) {
              path.selected = !path.selected;
            }
          }
        }

        updateSelectionState();

        if (this.hitResult) {
          if (this.hitResult.item.selected) {
            setCanvasCursor('cursor-arrow-small');
          } else {
            setCanvasCursor('cursor-arrow-white-shape');
          }
        }
      },
      mousedrag: (event: paper.ToolEvent) => {
        this.changed = true;
        if (this.mode === 'move-shapes') {
          setCanvasCursor('cursor-arrow-small');

          let delta = event.point.subtract(this.mouseStartPos);
          if (event.modifiers.shift) {
            delta = snapDeltaToAngle(delta, Math.PI * 2 / 8);
          }
          restoreSelectionState(this.originalContent);

          const selected = (paper.project as any).selectedItems;
          for (const item of selected) {
            item.position = item.position.add(delta);
          }
          updateSelectionState();
        } else if (this.mode === 'move-points') {
          setCanvasCursor('cursor-arrow-small');

          let delta = event.point.subtract(this.mouseStartPos);
          if (event.modifiers.shift) {
            delta = snapDeltaToAngle(delta, Math.PI * 2 / 8);
          }
          restoreSelectionState(this.originalContent);

          const selected = (paper.project as any).selectedItems;
          for (const path of selected) {
            for (const segment of path.segments) {
              if (segment.selected) {
                segment.point = segment.point.add(delta);
              }
            }
          }
          updateSelectionState();
        } else if (this.mode === 'move-handle') {
          const delta = event.point.subtract(this.mouseStartPos);

          if (this.hitResult.type === 'handle-out') {
            let handlePos = this.originalHandleOut.add(delta);
            if (event.modifiers.shift) {
              handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.hitResult.segment.handleOut = handlePos;
            this.hitResult.segment.handleIn = handlePos.normalize(-this.originalHandleIn.length);
          } else {
            let handlePos = this.originalHandleIn.add(delta);
            if (event.modifiers.shift) {
              handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.hitResult.segment.handleIn = handlePos;
            this.hitResult.segment.handleOut = handlePos.normalize(-this.originalHandleOut.length);
          }

          updateSelectionState();
        } else if (this.mode === 'box-select') {
          dragRect(this.mouseStartPos, event.point);
        }
      },
      mousemove: (event: paper.ToolEvent) => this.hitTest(event),
    });
  }

  resetHot(type: string, event: paper.ToolEvent, mode: string) {}

  testHot(type: string, event: paper.ToolEvent, mode: string) {
    if (mode !== 'tool-direct-select') {
      return undefined;
    }
    return this.hitTest(event);
  }

  hitTest(event: paper.ToolEvent) {
    const hitSize = 4;
    let hit = undefined;
    this.hitResult = undefined;

    // Hit test items.
    if (event.point) {
      this.hitResult = paper.project.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    // Hit test selected handles.
    hit = undefined;
    if (event.point) {
      hit = paper.project.hitTest(event.point, {
        selected: true,
        handles: true,
        tolerance: hitSize,
      });
    }
    if (hit) {
      this.hitResult = hit;
    }
    // Hit test points.
    hit = undefined;
    if (event.point) {
      hit = paper.project.hitTest(event.point, { segments: true, tolerance: hitSize });
    }
    if (hit) {
      this.hitResult = hit;
    }

    if (this.hitResult) {
      if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
        if (this.hitResult.item.selected) {
          setCanvasCursor('cursor-arrow-small');
        } else {
          setCanvasCursor('cursor-arrow-white-shape');
        }
      } else if (
        this.hitResult.type === 'segment' ||
        this.hitResult.type === 'handle-in' ||
        this.hitResult.type === 'handle-out'
      ) {
        if (this.hitResult.segment.selected) {
          setCanvasCursor('cursor-arrow-small-point');
        } else {
          setCanvasCursor('cursor-arrow-white-point');
        }
      }
    } else {
      setCanvasCursor('cursor-arrow-white');
    }

    return true;
  }
}

class ScaleTool extends paper.Tool implements CommonTool {
  private mouseStartPos = new paper.Point(0, 0);
  private mode: string;
  private hitResult: paper.HitResult;
  private pivot: paper.Point;
  private corner: paper.Point;
  private originalCenter: paper.Point;
  private originalSize: paper.Point;
  private originalContent: any[];
  private changed = false;

  constructor() {
    super();

    this.on({
      activate: () => {
        setCanvasCursor('cursor-arrow-black');
        updateSelectionState();
        showSelectionBounds();
      },
      deactivate: () => {
        hideSelectionBounds();
      },
      mousedown: (event: paper.ToolEvent) => {
        this.mode = undefined;
        this.changed = false;
        if (this.hitResult) {
          if (this.hitResult.type === 'bounds') {
            this.originalContent = captureSelectionState();
            this.mode = 'scale';
            const pivotName = (paper as any).Base.camelize(oppositeCorner[this.hitResult.name]);
            const cornerName = (paper as any).Base.camelize(this.hitResult.name);
            this.pivot = selectionBounds[pivotName].clone();
            this.corner = selectionBounds[cornerName].clone();
            this.originalSize = this.corner.subtract(this.pivot);
            this.originalCenter = selectionBounds.center;
          }
          updateSelectionState();
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        if (this.mode === 'scale') {
          if (this.changed) {
            clearSelectionBounds();
            // undo.snapshot('Scale Shapes');
          }
        }
      },
      mousedrag: (event: paper.ToolEvent) => {
        if (this.mode === 'scale') {
          let pivot = this.pivot;
          let originalSize = this.originalSize;

          if (event.modifiers.option) {
            pivot = this.originalCenter;
            originalSize = originalSize.multiply(0.5);
          }

          this.corner = this.corner.add(event.delta);
          const size = this.corner.subtract(pivot);
          let sx = 1.0;
          let sy = 1.0;
          if (Math.abs(originalSize.x) > 0.0000001) {
            sx = size.x / originalSize.x;
          }
          if (Math.abs(originalSize.y) > 0.0000001) {
            sy = size.y / originalSize.y;
          }

          if (event.modifiers.shift) {
            const signx = sx > 0 ? 1 : -1;
            const signy = sy > 0 ? 1 : -1;
            sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
            sx *= signx;
            sy *= signy;
          }

          restoreSelectionState(this.originalContent);

          const selected = (paper.project as any).selectedItems;
          for (const item of selected) {
            if (item.guide) {
              continue;
            }
            item.scale(sx, sy, pivot);
          }
          updateSelectionState();
          this.changed = true;
        }
      },
      mousemove: (event: paper.ToolEvent) => this.hitTest(event),
    });
  }

  resetHot(type: string, event: paper.ToolEvent, mode: string) {}

  testHot(type: string, event: paper.ToolEvent, mode: string) {
    return this.hitTest(event);
  }

  hitTest(event: paper.ToolEvent) {
    const hitSize = 6;
    this.hitResult = undefined;

    if (!selectionBoundsShape || !selectionBounds) {
      updateSelectionState();
    }

    if (!selectionBoundsShape || !selectionBounds) {
      return undefined;
    }

    // Hit test selection rectangle.
    if (event.point) {
      this.hitResult = selectionBoundsShape.hitTest(event.point, {
        bounds: true,
        guides: true,
        tolerance: hitSize,
      });
    }

    if (this.hitResult && this.hitResult.type === 'bounds') {
      // Normalize the direction so that corners are at 45° angles.
      const dir = event.point.subtract(selectionBounds.center);
      dir.x /= selectionBounds.width / 2;
      dir.y /= selectionBounds.height / 2;
      setCanvasScaleCursor(dir);
      return true;
    }

    return false;
  }
}

class RotateTool extends paper.Tool implements CommonTool {
  private mouseStartPos = new paper.Point(0, 0);
  private mode: string;
  private hitResult: paper.HitResult;
  private originalCenter: paper.Point;
  private originalAngle: number;
  private originalContent: any;
  private originalShape: any;
  private cursorDir: any;
  private changed = false;

  constructor() {
    super();

    this.on({
      activate: () => {
        setCanvasCursor('cursor-arrow-black');
        updateSelectionState();
        showSelectionBounds();
      },
      deactivate: () => hideSelectionBounds(),
      mousedown: (event: paper.ToolEvent) => {
        this.mode = undefined;
        this.changed = false;
        if (this.hitResult) {
          if (this.hitResult.type === 'bounds') {
            this.originalContent = captureSelectionState();
            this.originalShape = selectionBoundsShape.exportJSON({ asString: false });
            this.mode = 'rotate';
            this.originalCenter = selectionBounds.center.clone();
            const delta = event.point.subtract(this.originalCenter);
            this.originalAngle = Math.atan2(delta.y, delta.x);
          }
          updateSelectionState();
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        if (this.mode === 'rotate') {
          if (this.changed) {
            clearSelectionBounds();
            // undo.snapshot('Rotate Shapes');
          }
        }
        updateSelectionState();
      },
      mousedrag: (event: paper.ToolEvent) => {
        if (this.mode === 'rotate') {
          const delta = event.point.subtract(this.originalCenter);
          const angle = Math.atan2(delta.y, delta.x);
          let da = angle - this.originalAngle;

          if (event.modifiers.shift) {
            const snapeAngle = Math.PI / 4;
            da = Math.round(da / snapeAngle) * snapeAngle;
          }

          restoreSelectionState(this.originalContent);

          const id = selectionBoundsShape.id;
          selectionBoundsShape.importJSON(this.originalShape);
          selectionBoundsShape._id = id;

          const deg = da / Math.PI * 180;

          selectionBoundsShape.rotate(deg, this.originalCenter);

          const selected = (paper.project as any).selectedItems;
          for (const item of selected) {
            if (item.guide) {
              continue;
            }
            item.rotate(deg, this.originalCenter);
          }

          setCanvasRotateCursor(this.cursorDir, da);
          this.changed = true;
        }
      },
      mousemove: (event: paper.ToolEvent) => this.hitTest(event),
    });
  }

  resetHot(type: string, event: paper.ToolEvent, mode: string) {}

  testHot(type: string, event: paper.ToolEvent, mode: string) {
    return this.hitTest(event);
  }

  hitTest(event: paper.ToolEvent) {
    const hitSize = 12;
    this.hitResult = undefined;

    if (!selectionBoundsShape || !selectionBounds) {
      updateSelectionState();
    }

    if (!selectionBoundsShape || !selectionBounds) {
      return undefined;
    }

    // Hit test selection rectangle
    this.hitResult = undefined;
    if (event.point && !selectionBounds.contains(event.point)) {
      this.hitResult = selectionBoundsShape.hitTest(event.point, {
        bounds: true,
        guides: true,
        tolerance: hitSize,
      });
    }

    if (this.hitResult && this.hitResult.type === 'bounds') {
      // Normalize the direction so that corners are at 45° angles.
      const dir = event.point.subtract(selectionBounds.center);
      dir.x /= selectionBounds.width * 0.5;
      dir.y /= selectionBounds.height * 0.5;
      setCanvasRotateCursor(dir, 0);
      this.cursorDir = dir;
      return true;
    }

    return false;
  }
}

class ZoomPanTool extends paper.Tool implements CommonTool {
  private mouseStartPos = new paper.Point(0, 0);
  private distanceThreshold = 8;
  private mode = 'pan';
  private zoomFactor = 1.3;

  constructor() {
    super();

    this.on({
      activate: () => {
        setCanvasCursor('cursor-hand');
      },
      deactivate: () => {},
      mousedown: (event: paper.ToolEvent) => {
        this.mouseStartPos = event.point.subtract(paper.view.center);
        this.mode = '';
        if (event.modifiers.command) {
          this.mode = 'zoom';
        } else {
          setCanvasCursor('cursor-hand-grab');
          this.mode = 'pan';
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        if (this.mode === 'zoom') {
          const zoomCenter = event.point.subtract(paper.view.center);
          const moveFactor = this.zoomFactor - 1.0;
          if (event.modifiers.command && !event.modifiers.option) {
            paper.view.zoom *= this.zoomFactor;
            paper.view.center = paper.view.center.add(
              zoomCenter.multiply(moveFactor / this.zoomFactor),
            );
          } else if (event.modifiers.command && event.modifiers.option) {
            paper.view.zoom /= this.zoomFactor;
            paper.view.center = paper.view.center.subtract(zoomCenter.multiply(moveFactor));
          }
        } else if (this.mode === 'zoom-rect') {
          const start = paper.view.center.add(this.mouseStartPos);
          const end = event.point;
          paper.view.center = start.add(end).multiply(0.5);
          const dx = paper.view.bounds.width / Math.abs(end.x - start.x);
          const dy = paper.view.bounds.height / Math.abs(end.y - start.y);
          paper.view.zoom = Math.min(dx, dy) * paper.view.zoom;
        }
        this.hitTest(event);
        this.mode = '';
      },
      mousedrag: (event: paper.ToolEvent) => {
        if (this.mode === 'zoom') {
          // If dragging mouse while in zoom mode, switch to zoom-rect instead.
          this.mode = 'zoom-rect';
        } else if (this.mode === 'zoom-rect') {
          // While dragging the zoom rectangle, paint the selected area.
          dragRect(paper.view.center.add(this.mouseStartPos), event.point);
        } else if (this.mode === 'pan') {
          // Handle panning by moving the view center.
          const pt = event.point.subtract(paper.view.center);
          const delta = this.mouseStartPos.subtract(pt);
          paper.view.scrollBy(delta);
          this.mouseStartPos = pt;
        }
      },
      mousemove: (event: paper.ToolEvent) => this.hitTest(event),
      keydown: (event: paper.ToolEvent) => this.hitTest(event),
      keyup: (event: paper.ToolEvent) => this.hitTest(event),
    });
  }

  resetHot(type: string, event: paper.ToolEvent, mode: string) {}

  testHot(type: string, event: paper.ToolEvent, mode: string) {
    const spacePressed = event && event.modifiers.space;
    if (mode !== 'tool-zoompan' && !spacePressed) {
      return false;
    }
    return this.hitTest(event);
  }

  hitTest(event: paper.ToolEvent) {
    if (event.modifiers.command) {
      if (event.modifiers.command && !event.modifiers.option) {
        setCanvasCursor('cursor-zoom-in');
      } else if (event.modifiers.command && event.modifiers.option) {
        setCanvasCursor('cursor-zoom-out');
      }
    } else {
      setCanvasCursor('cursor-hand');
    }
    return true;
  }
}

class PenTool extends paper.Tool implements CommonTool {
  private pathId = -1;
  private mode: string;
  private hitResult: paper.HitResult;
  private mouseStartPos: paper.Point;
  private originalHandleIn: paper.Point;
  private originalHandleOut: paper.Point;
  private currentSegment: paper.Segment;

  constructor(toolStack: { getToolMode: () => string }) {
    super();

    this.on({
      activate: () => setCanvasCursor('cursor-pen-add'),
      deactivate: () => {
        if (toolStack.getToolMode() !== 'tool-pen') {
          this.closePath();
          updateSelectionState();
        }
        this.currentSegment = undefined;
      },
      mousedown: (event: paper.ToolEvent) => {
        deselectAllPoints();

        if (this.mode === 'create') {
          let path = findItemById(this.pathId);
          if (path === undefined) {
            deselectAll();
            path = new paper.Path();
            path.strokeColor = 'black';
            this.pathId = path.id;
          }
          this.currentSegment = path.add(event.point);

          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.currentSegment.handleIn.clone();
          this.originalHandleOut = this.currentSegment.handleOut.clone();
        } else if (this.mode === 'insert') {
          if (this.hitResult !== undefined) {
            const location = this.hitResult.location;

            const values = (location.curve as any).getValues();
            const isLinear = location.curve.isLinear();
            const parts = (paper.Curve as any).subdivide(values, location.parameter);
            const left = parts[0];
            const right = parts[1];

            const x = left[6];
            const y = left[7];
            const segment = new paper.Segment(
              new paper.Point(x, y),
              !isLinear && new paper.Point(left[4] - x, left[5] - y),
              !isLinear && new paper.Point(right[2] - x, right[3] - y),
            );

            const seg = (this.hitResult.item as paper.Path).insert(location.index + 1, segment);

            if (!isLinear) {
              seg.previous.handleOut.x = left[2] - left[0];
              seg.previous.handleOut.y = left[3] - left[1];
              seg.next.handleIn.x = right[4] - right[6];
              seg.next.handleIn.y = right[5] - right[7];
            }

            deselectAllPoints();
            seg.selected = true;

            this.hitResult = undefined;
          }
        } else if (this.mode === 'close') {
          if (this.pathId !== -1) {
            const path = findItemById(this.pathId);
            path.closed = true;
          }

          this.currentSegment = this.hitResult.segment;
          this.currentSegment.handleIn.x = 0;
          this.currentSegment.handleIn.y = 0;

          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.currentSegment.handleIn.clone();
          this.originalHandleOut = this.currentSegment.handleOut.clone();
        } else if (this.mode === 'adjust') {
          this.currentSegment = this.hitResult.segment;
          this.currentSegment.handleOut.x = 0;
          this.currentSegment.handleOut.y = 0;

          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.currentSegment.handleIn.clone();
          this.originalHandleOut = this.currentSegment.handleOut.clone();
        } else if (this.mode === 'continue') {
          if (this.hitResult.segment.index === 0) {
            this.hitResult.item.reverseChildren();
          }

          this.pathId = this.hitResult.item.id;
          this.currentSegment = this.hitResult.segment;
          this.currentSegment.handleOut.x = 0;
          this.currentSegment.handleOut.y = 0;

          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.currentSegment.handleIn.clone();
          this.originalHandleOut = this.currentSegment.handleOut.clone();
        } else if (this.mode === 'convert') {
          this.pathId = this.hitResult.item.id;
          this.currentSegment = this.hitResult.segment;
          this.currentSegment.handleIn.x = 0;
          this.currentSegment.handleIn.y = 0;
          this.currentSegment.handleOut.x = 0;
          this.currentSegment.handleOut.y = 0;

          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.currentSegment.handleIn.clone();
          this.originalHandleOut = this.currentSegment.handleOut.clone();
        } else if (this.mode === 'join') {
          const path = findItemById(this.pathId);
          if (path !== undefined) {
            const oldPoint = this.hitResult.segment.point.clone();
            if (this.hitResult.segment.index !== 0) {
              (this.hitResult.item as paper.Path).reverse();
            }
            path.join(this.hitResult.item);
            // Find nearest point to the hit point.
            let imin = -1;
            let dmin = 0;
            for (let i = 0; i < path.segments.length; i++) {
              const d = oldPoint.getDistance(path.segments[i].point);
              if (imin === -1 || d < dmin) {
                dmin = d;
                imin = i;
              }
            }
            this.currentSegment = path.segments[imin];
            this.currentSegment.handleIn.x = 0;
            this.currentSegment.handleIn.y = 0;

            this.mouseStartPos = event.point.clone();
            this.originalHandleIn = this.currentSegment.handleIn.clone();
            this.originalHandleOut = this.currentSegment.handleOut.clone();
          } else {
            this.currentSegment = undefined;
          }
        } else if (this.mode === 'remove') {
          if (this.hitResult !== undefined) {
            (this.hitResult.item as paper.Path).removeSegment(this.hitResult.segment.index);
            this.hitResult = undefined;
          }
        }

        if (this.currentSegment) {
          this.currentSegment.selected = true;
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        if (this.mode === 'close') {
          this.closePath();
        } else if (this.mode === 'join') {
          this.closePath();
        } else if (this.mode === 'convert') {
          this.closePath();
        }
        // undo.snapshot('Pen');
        this.mode = undefined;
        this.currentSegment = undefined;
      },
      mousedrag: (event: paper.ToolEvent) => {
        if (this.currentSegment === undefined) {
          return;
        }
        const path = findItemById(this.pathId);
        if (path === undefined) {
          return;
        }

        let dragIn = false;
        let dragOut = false;
        let invert = false;

        if (this.mode === 'create') {
          dragOut = true;
          if (this.currentSegment.index > 0) {
            dragIn = true;
          }
        } else if (this.mode === 'close') {
          dragIn = true;
          invert = true;
        } else if (this.mode === 'continue') {
          dragOut = true;
        } else if (this.mode === 'adjust') {
          dragOut = true;
        } else if (this.mode === 'join') {
          dragIn = true;
          invert = true;
        } else if (this.mode === 'convert') {
          dragIn = true;
          dragOut = true;
        }

        if (dragIn || dragOut) {
          let delta = event.point.subtract(this.mouseStartPos);
          if (invert) {
            delta = new paper.Point(-delta.x, -delta.y);
          }
          if (dragIn && dragOut) {
            let handlePos = this.originalHandleOut.add(delta);
            if (event.modifiers.shift) {
              handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.currentSegment.handleOut = handlePos;
            this.currentSegment.handleIn = new paper.Point(-handlePos.x, -handlePos.y);
          } else if (dragOut) {
            let handlePos = this.originalHandleOut.add(delta);
            if (event.modifiers.shift) {
              handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.currentSegment.handleOut = handlePos;
            this.currentSegment.handleIn = handlePos.normalize(-this.originalHandleIn.length);
          } else {
            let handlePos = this.originalHandleIn.add(delta);
            if (event.modifiers.shift) {
              handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.currentSegment.handleIn = handlePos;
            this.currentSegment.handleOut = handlePos.normalize(-this.originalHandleOut.length);
          }
        }
      },
      mousemove: (event: paper.ToolEvent) => {
        this.hitTest(event);
      },
    });
  }

  resetHot(type: string, event: paper.ToolEvent, mode: string) {}

  testHot(type: string, event: paper.ToolEvent, mode: string) {
    if (mode !== 'tool-pen') {
      return false;
    }
    if (event.modifiers.command) {
      return false;
    }
    if (type === 'keyup') {
      if (event.modifiers.key === 'enter' || event.modifiers.key === 'escape') {
        this.closePath();
      }
    }
    return this.hitTest(event);
  }

  hitTest(event: paper.ToolEvent) {
    const hitSize = 4;
    let result = undefined;
    // var isKeyEvent = type ==='mode' || type ==='command' || type ==='keydown' || type ==='keyup';

    this.currentSegment = undefined;
    this.hitResult = undefined;

    if (event.point) {
      result = paper.project.hitTest(event.point, {
        segments: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    if (result) {
      if (result.type === 'stroke') {
        if (result.item.selected) {
          // Insert point.
          this.mode = 'insert';
          setCanvasCursor('cursor-pen-add');
        } else {
          result = undefined;
        }
      } else if (result.type === 'segment') {
        const last = result.item.segments.length - 1;
        if (!result.item.closed && (result.segment.index === 0 || result.segment.index === last)) {
          if (result.item.id === this.pathId) {
            if (result.segment.index === 0) {
              // Close
              this.mode = 'close';
              setCanvasCursor('cursor-pen-close');
              this.updateTail(result.segment.point);
            } else {
              // Adjust last handle
              this.mode = 'adjust';
              setCanvasCursor('cursor-pen-adjust');
            }
          } else {
            if (this.pathId !== -1) {
              this.mode = 'join';
              setCanvasCursor('cursor-pen-join');
              this.updateTail(result.segment.point);
            } else {
              this.mode = 'continue';
              setCanvasCursor('cursor-pen-edit');
            }
          }
        } else if (result.item.selected) {
          if (event.modifiers.option) {
            this.mode = 'convert';
            setCanvasCursor('cursor-pen-adjust');
          } else {
            this.mode = 'remove';
            setCanvasCursor('cursor-pen-remove');
          }
        } else {
          result = undefined;
        }
      }
    }

    if (!result) {
      this.mode = 'create';
      setCanvasCursor('cursor-pen-create');
      if (event.point) {
        this.updateTail(event.point);
      }
    }

    this.hitResult = result;

    return true;
  }

  private closePath() {
    if (this.pathId !== -1) {
      deselectAllPoints();
      this.pathId = -1;
    }
  }

  private updateTail(point: paper.Point) {
    const path = findItemById(this.pathId);
    if (path === undefined) {
      return;
    }
    const nsegs = path.segments.length;
    if (nsegs === 0) {
      return;
    }

    const color = (paper.project.activeLayer as any).getSelectedColor();
    const tail = new paper.Path();
    tail.strokeColor = color ? color : '#009dec';
    tail.strokeWidth = 1.0 / paper.view.zoom;
    (tail as any).guide = true;

    const prevPoint = path.segments[nsegs - 1].point;
    const prevHandleOut = path.segments[nsegs - 1].point.add(path.segments[nsegs - 1].handleOut);

    tail.moveTo(prevPoint);
    tail.cubicCurveTo(prevHandleOut, point, point);

    tail.removeOn({
      drag: true,
      up: true,
      down: true,
      move: true,
    });
  }
}

function updateSelectionState() {
  clearSelectionBounds();
  selectionBounds = getSelectionBounds();
  if (selectionBounds !== undefined) {
    const rect = new paper.Path.Rectangle(selectionBounds);
    // var color = paper.project.activeLayer.getSelectedColor();
    rect.strokeColor = 'rgba(0,0,0,0)'; // color ? color : '#009dec';
    rect.strokeWidth = 1 / paper.view.zoom;
    // rect._boundsSelected = true;
    rect.selected = true;
    (rect as any).setFullySelected(true);
    (rect as any).guide = true;
    rect.visible = drawSelectionBounds > 0;
    // rect.transformContent = false;
    selectionBoundsShape = rect;
  }
  updateSelectionUI();
}

function clearSelectionBounds() {
  if (selectionBoundsShape) {
    selectionBoundsShape.remove();
  }
  selectionBoundsShape = undefined;
  selectionBounds = undefined;
}

function updateSelectionUI() {
  if (selectionBounds === undefined) {
    $('#cut').addClass('disabled');
    $('#copy').addClass('disabled');
    $('#delete').addClass('disabled');
  } else {
    $('#cut').removeClass('disabled');
    $('#copy').removeClass('disabled');
    $('#delete').removeClass('disabled');
  }

  if (clipboard === undefined) {
    $('#paste').addClass('disabled');
  } else {
    $('#paste').removeClass('disabled');
  }
}

// Returns bounding box of all selected items.
function getSelectionBounds() {
  let bounds = undefined;
  const selected = (paper.project as any).selectedItems;
  for (const item of selected) {
    if (bounds === undefined) {
      bounds = item.bounds.clone();
    } else {
      bounds = bounds.unite(item.bounds);
    }
  }
  return bounds;
}
// Returns all items intersecting the rect.
// Note: only the item outlines are tested.
function getPathsIntersectingRect(rect) {
  const paths = [];
  const boundingRect = new paper.Path.Rectangle(rect);

  function checkPathItem(item) {
    const children = item.children;
    if (item.equals(boundingRect)) {
      return;
    }
    if (!rect.intersects(item.bounds)) {
      return;
    }
    if (item instanceof paper.PathItem) {
      if (rect.contains(item.bounds)) {
        paths.push(item);
        return;
      }
      const isects = boundingRect.getIntersections(item);
      if (isects.length > 0) {
        paths.push(item);
      }
    } else {
      for (let j = children.length - 1; j >= 0; j--) {
        checkPathItem(children[j]);
      }
    }
  }

  for (let i = 0, l = paper.project.layers.length; i < l; i++) {
    const layer = paper.project.layers[i];
    checkPathItem(layer);
  }

  boundingRect.remove();

  return paths;
}

function setCanvasCursor(name) {
  // TODO: make this a constant somehow...
  $('.paper-canvas')
    .removeClass(function(index, css) {
      return (css.match(/\bcursor-\S+/g) || []).join(' ');
    })
    .addClass(name);
}

// Restore the state of selected items.
function restoreSelectionState(originalContent) {
  // TODO: could use findItemById() instead.
  for (const orig of originalContent) {
    const item = findItemById(orig.id);
    if (!item) {
      continue;
    }
    // HACK: paper does not retain item IDs after importJSON,
    // store the ID here, and restore after deserialization.
    const id = item.id;
    item.importJSON(orig.json);
    item._id = id;
  }
}

function findItemById(id: number) {
  if (id === -1) {
    return undefined;
  }
  function findItem(item: paper.Item) {
    if (item.id === id) {
      return item;
    }
    if (item.children) {
      for (let j = item.children.length - 1; j >= 0; j--) {
        const it = findItem(item.children[j]);
        if (it !== undefined) {
          return it;
        }
      }
    }
    return undefined;
  }

  for (let i = 0, l = paper.project.layers.length; i < l; i++) {
    const layer = paper.project.layers[i];
    const it = findItem(layer);
    if (it !== undefined) {
      return it;
    }
  }
  return undefined;
}

// Returns path points which are contained in the rect.
function getSegmentsInRect(rect) {
  const segments = [];

  function checkPathItem(item) {
    if (item._locked || !item._visible || item._guide) {
      return;
    }
    const children = item.children;
    if (!rect.intersects(item.bounds)) {
      return;
    }
    if (item instanceof paper.Path) {
      for (const segment of item.segments) {
        if (rect.contains(segment.point)) {
          segments.push(segment);
        }
      }
    } else {
      for (let j = children.length - 1; j >= 0; j--) {
        checkPathItem(children[j]);
      }
    }
  }

  for (let i = paper.project.layers.length - 1; i >= 0; i--) {
    checkPathItem(paper.project.layers[i]);
  }

  return segments;
}

function snapDeltaToAngle(delta, snapAngle) {
  let angle = Math.atan2(delta.y, delta.x);
  angle = Math.round(angle / snapAngle) * snapAngle;
  const dirx = Math.cos(angle);
  const diry = Math.sin(angle);
  const d = dirx * delta.x + diry * delta.y;
  return new paper.Point(dirx * d, diry * d);
}

function deselectAll() {
  paper.project.deselectAll();
}

function deselectAllPoints() {
  const selected = (paper.project as any).selectedItems;
  for (const item of selected) {
    if (item instanceof paper.Path) {
      for (const segment of item.segments) {
        if (segment.selected) {
          segment.selected = false;
        }
      }
    }
  }
}

// Returns serialized contents of selected items.
function captureSelectionState() {
  const originalContent = [];
  const selected = (paper.project as any).selectedItems;
  for (const item of selected) {
    if (item.guide) {
      continue;
    }
    const orig = {
      id: item.id,
      json: item.exportJSON({ asString: false }),
      selectedSegments: [],
    };
    originalContent.push(orig);
  }
  return originalContent;
}

function dragRect(p1, p2) {
  // Create pixel perfect dotted rectable for drag selections.
  const half = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
  const start = p1.add(half);
  const end = p2.add(half);
  const rect = new paper.CompoundPath(undefined);
  rect.moveTo(start);
  rect.lineTo(new paper.Point(start.x, end.y));
  rect.lineTo(end);
  rect.moveTo(start);
  rect.lineTo(new paper.Point(end.x, start.y));
  rect.lineTo(end);
  rect.strokeColor = 'black';
  rect.strokeWidth = 1.0 / paper.view.zoom;
  rect.dashOffset = 0.5 / paper.view.zoom;
  rect.dashArray = [1.0 / paper.view.zoom, 1.0 / paper.view.zoom];
  rect.removeOn({
    drag: true,
    up: true,
  });
  (rect as any).guide = true;
  return rect;
}

function showSelectionBounds() {
  drawSelectionBounds++;
  if (drawSelectionBounds > 0) {
    if (selectionBoundsShape) {
      selectionBoundsShape.visible = true;
    }
  }
}

function hideSelectionBounds() {
  if (drawSelectionBounds > 0) {
    drawSelectionBounds--;
  }
  if (drawSelectionBounds === 0) {
    if (selectionBoundsShape) {
      selectionBoundsShape.visible = false;
    }
  }
}

function indexFromAngle(angle) {
  const octant = Math.PI * 2 / 8;
  let index = Math.round(angle / octant);
  if (index < 0) {
    index += 8;
  }
  return index % 8;
}

function setCanvasRotateCursor(dir, da) {
  // zero is up, counter clockwise
  const angle = Math.atan2(dir.x, -dir.y) + da;
  const index = indexFromAngle(angle);
  const cursors = [
    'cursor-rotate-0',
    'cursor-rotate-45',
    'cursor-rotate-90',
    'cursor-rotate-135',
    'cursor-rotate-180',
    'cursor-rotate-225',
    'cursor-rotate-270',
    'cursor-rotate-315',
  ];
  setCanvasCursor(cursors[index % 8]);
}

function setCanvasScaleCursor(dir) {
  // zero is up, counter clockwise
  const angle = Math.atan2(dir.x, -dir.y);
  const index = indexFromAngle(angle);
  const cursors = ['cursor-scale-0', 'cursor-scale-45', 'cursor-scale-90', 'cursor-scale-135'];
  setCanvasCursor(cursors[index % 4]);
}
