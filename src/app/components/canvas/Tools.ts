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

export interface ToolStack extends paper.Tool {
  stack?: any;
  mode?: string;
  hotTool?: any;
  activeTool?: any;
  lastPoint?: paper.Point;
  command?: Function;
  setToolMode?: Function;
  testHot?: Function;
}

export function createToolStack() {
  const toolStack: ToolStack = new paper.Tool();
  toolStack.stack = [
    createToolZoomPan(),
    createToolPen(toolStack),
    createToolScale(),
    createToolRotate(),
    createToolDirectSelect(),
    createToolSelect(),
  ];
  toolStack.hotTool = undefined;
  toolStack.activeTool = undefined;
  toolStack.lastPoint = new paper.Point(0, 0);
  toolStack.command = function(cb) {
    if (this.activeTool !== undefined) {
      return;
    }
    /*	if (this.hotTool) {
		this.hotTool.fire('deactivate');
		this.hotTool = undefined;
	}*/
    if (cb) {
      cb();
    }
    const event = new paper.Event();
    (event as any).point = this.lastPoint.clone();
    this.testHot('command', event);
  };
  toolStack.setToolMode = function(mode) {
    this.mode = mode;
    const event = new paper.Event();
    (event as any).point = this.lastPoint.clone();
    this.testHot('mode', event);
  };
  toolStack.testHot = function(type, event) {
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
  };
  toolStack.on({
    activate: function() {
      this.activeTool = undefined;
      this.hotTool = undefined;
    },

    deactivate: function() {
      this.activeTool = undefined;
      this.hotTool = undefined;
    },

    mousedown: function(event) {
      this.lastPoint = event.point.clone();
      if (this.hotTool) {
        this.activeTool = this.hotTool;
        this.activeTool.fire('mousedown', event);
      }
    },

    mouseup: function(event) {
      this.lastPoint = event.point.clone();
      if (this.activeTool) {
        this.activeTool.fire('mouseup', event);
      }
      this.activeTool = undefined;
      this.testHot('mouseup', event);
    },

    mousedrag: function(event) {
      this.lastPoint = event.point.clone();
      if (this.activeTool) {
        this.activeTool.fire('mousedrag', event);
      }
    },

    mousemove: function(event) {
      this.lastPoint = event.point.clone();
      this.testHot('mousemove', event);
    },

    keydown: function(event) {
      event.point = this.lastPoint.clone();
      if (this.activeTool) {
        this.activeTool.fire('keydown', event);
      } else {
        this.testHot('keydown', event);
      }
    },

    keyup: function(event) {
      event.point = this.lastPoint.clone();
      if (this.activeTool) {
        this.activeTool.fire('keyup', event);
      } else {
        this.testHot('keyup', event);
      }
    },
  });

  return toolStack;
}

function createToolSelect() {
  interface ToolSelect extends paper.Tool {
    mouseStartPos?: paper.Point;
    mode?: string;
    hitItem?: paper.Item;
    originalContent?: any; // Array of objects?
    changed?: boolean;
    duplicates?: any; // Array of objects?
    createDuplicates?: (content: any) => void;
    removeDuplicates?: () => void;
    resetHot?: Function;
    testHot?: Function;
    hitTest?: Function;
  }

  const toolSelect: ToolSelect = new paper.Tool();
  toolSelect.mouseStartPos = new paper.Point(0, 0);
  toolSelect.mode = undefined;
  toolSelect.hitItem = undefined;
  toolSelect.originalContent = undefined;
  toolSelect.changed = false;
  toolSelect.duplicates = undefined;

  toolSelect.createDuplicates = function(content) {
    this.duplicates = [];
    for (const orig of content) {
      const item: any = paper.project.importJSON(orig.json);
      if (item) {
        item.selected = false;
        this.duplicates.push(item);
      }
    }
  };
  toolSelect.removeDuplicates = function() {
    for (const dup of this.duplicates) {
      dup.remove();
    }
    this.duplicates = undefined;
  };

  toolSelect.resetHot = function(type, event, mode) {};
  toolSelect.testHot = function(type, event, mode) {
    /*	if (mode !=='tool-select')
		return false;*/
    return this.hitTest(event);
  };
  toolSelect.hitTest = function(event) {
    const hitSize = 4.0; // / paper.view.zoom;
    this.hitItem = undefined;

    // Hit test items.
    if (event.point) {
      this.hitItem = paper.project.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    if (this.hitItem) {
      if (this.hitItem.type === 'fill' || this.hitItem.type === 'stroke') {
        if (this.hitItem.item.selected) {
          setCanvasCursor('cursor-arrow-small');
        } else {
          setCanvasCursor('cursor-arrow-black-shape');
        }
      }
    } else {
      setCanvasCursor('cursor-arrow-black');
    }

    return true;
  };
  toolSelect.on({
    activate: function() {
      $('#tools').children().removeClass('selected');
      $('#tool-select').addClass('selected');
      setCanvasCursor('cursor-arrow-black');
      updateSelectionState();
      showSelectionBounds();
    },
    deactivate: function() {
      hideSelectionBounds();
    },
    mousedown: function(event) {
      this.mode = undefined;
      this.changed = false;

      if (this.hitItem) {
        if (this.hitItem.type === 'fill' || this.hitItem.type === 'stroke') {
          if (event.modifiers.shift) {
            this.hitItem.item.selected = !this.hitItem.item.selected;
          } else {
            if (!this.hitItem.item.selected) {
              deselectAll();
            }
            this.hitItem.item.selected = true;
          }
          if (this.hitItem.item.selected) {
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
    mouseup: function(event) {
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

      if (this.hitItem) {
        if (this.hitItem.item.selected) {
          setCanvasCursor('cursor-arrow-small');
        } else {
          setCanvasCursor('cursor-arrow-black-shape');
        }
      }
    },
    mousedrag: function(event) {
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
    mousemove: function(event) {
      this.hitTest(event);
    },
  });

  return toolSelect as paper.Tool;
}

function createToolDirectSelect() {
  interface ToolDirectSelect extends paper.Tool {
    mouseStartPos?: paper.Point;
    mode?: string;
    hitItem?: paper.Item;
    originalContent?: any; // Array of objects?
    changed?: boolean;
    duplicates?: any; // Array of objects?
    originalHandleIn?: any; // Handle object?
    originalHandleOut?: any; // Handle object?
    resetHot?: Function;
    testHot?: Function;
    hitTest?: Function;
  }

  const toolDirectSelect: ToolDirectSelect = new paper.Tool();
  toolDirectSelect.mouseStartPos = new paper.Point(0, 0);
  toolDirectSelect.mode = undefined;
  toolDirectSelect.hitItem = undefined;
  toolDirectSelect.originalContent = undefined;
  toolDirectSelect.originalHandleIn = undefined;
  toolDirectSelect.originalHandleOut = undefined;
  toolDirectSelect.changed = false;

  toolDirectSelect.resetHot = function(type, event, mode) {};
  toolDirectSelect.testHot = function(type, event, mode) {
    if (mode !== 'tool-direct-select') {
      return;
    }
    return this.hitTest(event);
  };

  toolDirectSelect.hitTest = function(event) {
    const hitSize = 4.0; // / paper.view.zoom;
    let hit = undefined;
    this.hitItem = undefined;

    // Hit test items.
    if (event.point) {
      this.hitItem = paper.project.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    // Hit test selected handles
    hit = undefined;
    if (event.point) {
      hit = paper.project.hitTest(event.point, {
        selected: true,
        handles: true,
        tolerance: hitSize,
      });
    }
    if (hit) {
      this.hitItem = hit;
    }
    // Hit test points
    hit = undefined;
    if (event.point) {
      hit = paper.project.hitTest(event.point, { segments: true, tolerance: hitSize });
    }
    if (hit) {
      this.hitItem = hit;
    }

    if (this.hitItem) {
      if (this.hitItem.type === 'fill' || this.hitItem.type === 'stroke') {
        if (this.hitItem.item.selected) {
          setCanvasCursor('cursor-arrow-small');
        } else {
          setCanvasCursor('cursor-arrow-white-shape');
        }
      } else if (
        this.hitItem.type === 'segment' ||
        this.hitItem.type === 'handle-in' ||
        this.hitItem.type === 'handle-out'
      ) {
        if (this.hitItem.segment.selected) {
          setCanvasCursor('cursor-arrow-small-point');
        } else {
          setCanvasCursor('cursor-arrow-white-point');
        }
      }
    } else {
      setCanvasCursor('cursor-arrow-white');
    }

    return true;
  };
  toolDirectSelect.on({
    activate: function() {
      $('#tools').children().removeClass('selected');
      $('#tool-direct-select').addClass('selected');
      setCanvasCursor('cursor-arrow-white');
      // this.hitItem = undefined;
    },
    deactivate: function() {
      // this.clearSelectionBounds();
    },
    mousedown: function(event) {
      this.mode = undefined;
      this.changed = false;

      if (this.hitItem) {
        if (this.hitItem.type === 'fill' || this.hitItem.type === 'stroke') {
          if (event.modifiers.shift) {
            this.hitItem.item.selected = !this.hitItem.item.selected;
          } else {
            if (!this.hitItem.item.selected) {
              deselectAll();
            }
            this.hitItem.item.selected = true;
          }
          if (this.hitItem.item.selected) {
            this.mode = 'move-shapes';
            deselectAllPoints();
            this.mouseStartPos = event.point.clone();
            this.originalContent = captureSelectionState();
          }
        } else if (this.hitItem.type === 'segment') {
          if (event.modifiers.shift) {
            this.hitItem.segment.selected = !this.hitItem.segment.selected;
          } else {
            if (!this.hitItem.segment.selected) {
              deselectAllPoints();
            }
            this.hitItem.segment.selected = true;
          }
          if (this.hitItem.segment.selected) {
            this.mode = 'move-points';
            this.mouseStartPos = event.point.clone();
            this.originalContent = captureSelectionState();
          }
        } else if (this.hitItem.type === 'handle-in' || this.hitItem.type === 'handle-out') {
          this.mode = 'move-handle';
          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.hitItem.segment.handleIn.clone();
          this.originalHandleOut = this.hitItem.segment.handleOut.clone();

          /*				if (this.hitItem.type ==='handle-out') {
					this.originalHandlePos = this.hitItem.segment.handleOut.clone();
					this.originalOppHandleLength = this.hitItem.segment.handleIn.length;
				} else {
					this.originalHandlePos = this.hitItem.segment.handleIn.clone();
					this.originalOppHandleLength = this.hitItem.segment.handleOut.length;
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
    mouseup: function(event) {
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

      if (this.hitItem) {
        if (this.hitItem.item.selected) {
          setCanvasCursor('cursor-arrow-small');
        } else {
          setCanvasCursor('cursor-arrow-white-shape');
        }
      }
    },
    mousedrag: function(event) {
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

        if (this.hitItem.type === 'handle-out') {
          let handlePos = this.originalHandleOut.add(delta);
          if (event.modifiers.shift) {
            handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
          }
          this.hitItem.segment.handleOut = handlePos;
          this.hitItem.segment.handleIn = handlePos.normalize(-this.originalHandleIn.length);
        } else {
          let handlePos = this.originalHandleIn.add(delta);
          if (event.modifiers.shift) {
            handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
          }
          this.hitItem.segment.handleIn = handlePos;
          this.hitItem.segment.handleOut = handlePos.normalize(-this.originalHandleOut.length);
        }

        updateSelectionState();
      } else if (this.mode === 'box-select') {
        dragRect(this.mouseStartPos, event.point);
      }
    },
    mousemove: function(event) {
      this.hitTest(event);
    },
  });

  return toolDirectSelect as paper.Tool;
}

function createToolScale() {
  interface ToolScale extends paper.Tool {
    mouseStartPos?: paper.Point;
    mode?: string;
    hitItem?: paper.Item;
    pivot?: any;
    corner?: any;
    originalCenter?: any;
    originalSize?: any;
    originalContent?: any;
    changed?: boolean;
    resetHot?: Function;
    testHot?: Function;
    hitTest?: Function;
  }

  const toolScale: ToolScale = new paper.Tool();
  toolScale.mouseStartPos = new paper.Point(0, 0);
  toolScale.mode = undefined;
  toolScale.hitItem = undefined;
  toolScale.pivot = undefined;
  toolScale.corner = undefined;
  toolScale.originalCenter = undefined;
  toolScale.originalSize = undefined;
  toolScale.originalContent = undefined;
  toolScale.changed = false;

  toolScale.resetHot = function(type, event, mode) {};
  toolScale.testHot = function(type, event, mode) {
    /*	if (mode !=='tool-select')
		return false;*/
    return this.hitTest(event);
  };

  toolScale.hitTest = function(event) {
    const hitSize = 6.0; // / paper.view.zoom;
    this.hitItem = undefined;

    if (!selectionBoundsShape || !selectionBounds) {
      updateSelectionState();
    }

    if (!selectionBoundsShape || !selectionBounds) {
      return undefined;
    }

    // Hit test selection rectangle
    if (event.point) {
      this.hitItem = selectionBoundsShape.hitTest(event.point, {
        bounds: true,
        guides: true,
        tolerance: hitSize,
      });
    }

    if (this.hitItem && this.hitItem.type === 'bounds') {
      // Normalize the direction so that corners are at 45° angles.
      const dir = event.point.subtract(selectionBounds.center);
      dir.x /= selectionBounds.width * 0.5;
      dir.y /= selectionBounds.height * 0.5;
      setCanvasScaleCursor(dir);
      return true;
    }

    return false;
  };

  toolScale.on({
    activate: function() {
      $('#tools').children().removeClass('selected');
      $('#tool-select').addClass('selected');
      setCanvasCursor('cursor-arrow-black');
      updateSelectionState();
      showSelectionBounds();
    },
    deactivate: function() {
      hideSelectionBounds();
    },
    mousedown: function(event) {
      this.mode = undefined;
      this.changed = false;
      if (this.hitItem) {
        if (this.hitItem.type === 'bounds') {
          this.originalContent = captureSelectionState();
          this.mode = 'scale';
          const pivotName = (paper as any).Base.camelize(oppositeCorner[this.hitItem.name]);
          const cornerName = (paper as any).Base.camelize(this.hitItem.name);
          this.pivot = selectionBounds[pivotName].clone();
          this.corner = selectionBounds[cornerName].clone();
          this.originalSize = this.corner.subtract(this.pivot);
          this.originalCenter = selectionBounds.center;
        }
        updateSelectionState();
      }
    },
    mouseup: function(event) {
      if (this.mode === 'scale') {
        if (this.changed) {
          clearSelectionBounds();
          // undo.snapshot('Scale Shapes');
        }
      }
    },
    mousedrag: function(event) {
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
    mousemove: function(event) {
      this.hitTest(event);
    },
  });

  return toolScale as paper.Tool;
}

function createToolRotate() {
  interface ToolRotate extends paper.Tool {
    mouseStartPos?: paper.Point;
    mode?: string;
    hitItem?: paper.Item;
    originalCenter?: any;
    originalAngle?: any;
    originalContent?: any;
    originalShape?: any;
    cursorDir?: any;
    changed?: boolean;
    resetHot?: Function;
    testHot?: Function;
    hitTest?: Function;
  }

  const toolRotate: ToolRotate = new paper.Tool();
  toolRotate.mouseStartPos = new paper.Point(0, 0);
  toolRotate.mode = undefined;
  toolRotate.hitItem = undefined;
  toolRotate.originalCenter = undefined;
  toolRotate.originalAngle = 0;
  toolRotate.originalContent = undefined;
  toolRotate.originalShape = undefined;
  toolRotate.cursorDir = undefined;
  toolRotate.changed = false;

  toolRotate.resetHot = function(type, event, mode) {};
  toolRotate.testHot = function(type, event, mode) {
    /*	if (mode !=='tool-select')
		return false;*/
    return this.hitTest(event);
  };

  toolRotate.hitTest = function(event) {
    const hitSize = 12.0; // / paper.view.zoom;
    this.hitItem = undefined;

    if (!selectionBoundsShape || !selectionBounds) {
      updateSelectionState();
    }

    if (!selectionBoundsShape || !selectionBounds) {
      return undefined;
    }

    // Hit test selection rectangle
    this.hitItem = undefined;
    if (event.point && !selectionBounds.contains(event.point)) {
      this.hitItem = selectionBoundsShape.hitTest(event.point, {
        bounds: true,
        guides: true,
        tolerance: hitSize,
      });
    }

    if (this.hitItem && this.hitItem.type === 'bounds') {
      // Normalize the direction so that corners are at 45° angles.
      const dir = event.point.subtract(selectionBounds.center);
      dir.x /= selectionBounds.width * 0.5;
      dir.y /= selectionBounds.height * 0.5;
      setCanvasRotateCursor(dir, 0);
      toolRotate.cursorDir = dir;
      return true;
    }

    return false;
  };

  toolRotate.on({
    activate: function() {
      $('#tools').children().removeClass('selected');
      $('#tool-select').addClass('selected');
      setCanvasCursor('cursor-arrow-black');
      updateSelectionState();
      showSelectionBounds();
    },
    deactivate: function() {
      hideSelectionBounds();
    },
    mousedown: function(event) {
      this.mode = undefined;
      this.changed = false;
      if (this.hitItem) {
        if (this.hitItem.type === 'bounds') {
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
    mouseup: function(event) {
      if (this.mode === 'rotate') {
        if (this.changed) {
          clearSelectionBounds();
          // undo.snapshot('Rotate Shapes');
        }
      }
      updateSelectionState();
    },
    mousedrag: function(event) {
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

        setCanvasRotateCursor(toolRotate.cursorDir, da);
        this.changed = true;
      }
    },
    mousemove: function(event) {
      this.hitTest(event);
    },
  });

  return toolRotate as paper.Tool;
}

function createToolZoomPan() {
  interface ToolPanZoom extends paper.Tool {
    mouseStartPos?: paper.Point;
    distanceThreshold?: number;
    mode?: string;
    zoomFactor?: number;
    resetHot?: Function;
    testHot?: Function;
    hitTest?: Function;
  }

  const toolZoomPan: ToolPanZoom = new paper.Tool();
  toolZoomPan.distanceThreshold = 8;
  toolZoomPan.mouseStartPos = new paper.Point(0, 0);
  toolZoomPan.mode = 'pan';
  toolZoomPan.zoomFactor = 1.3;
  toolZoomPan.resetHot = function(type, event, mode) {};
  toolZoomPan.testHot = function(type, event, mode) {
    const spacePressed = event && event.modifiers.space;
    if (mode !== 'tool-zoompan' && !spacePressed) {
      return false;
    }
    return this.hitTest(event);
  };
  toolZoomPan.hitTest = function(event) {
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
  };
  toolZoomPan.on({
    activate: function() {
      $('#tools').children().removeClass('selected');
      $('#tool-zoompan').addClass('selected');
      setCanvasCursor('cursor-hand');
    },
    deactivate: function() {},
    mousedown: function(event) {
      this.mouseStartPos = event.point.subtract(paper.view.center);
      this.mode = '';
      if (event.modifiers.command) {
        this.mode = 'zoom';
      } else {
        setCanvasCursor('cursor-hand-grab');
        this.mode = 'pan';
      }
    },
    mouseup: function(event) {
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
    mousedrag: function(event) {
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

    mousemove: function(event) {
      this.hitTest(event);
    },

    keydown: function(event) {
      this.hitTest(event);
    },

    keyup: function(event) {
      this.hitTest(event);
    },
  });

  return toolZoomPan as paper.Tool;
}

function createToolPen(toolStack: { mode?: string }) {
  interface ToolPen extends paper.Tool {
    pathId?: number;
    hitResult?: any;
    mouseStartPos?: paper.Point;
    originalHandleIn?: any;
    originalHandleOut?: any;
    currentSegment?: any;
    closePath?: Function;
    resetHot?: Function;
    testHot?: Function;
    updateTail?: Function;
    hitTest?: Function;
  }

  const toolPen: ToolPen = new paper.Tool();
  toolPen.pathId = -1;
  toolPen.hitResult = undefined;
  toolPen.mouseStartPos = undefined;
  toolPen.originalHandleIn = undefined;
  toolPen.originalHandleOut = undefined;
  toolPen.currentSegment = undefined;

  toolPen.closePath = function() {
    if (this.pathId !== -1) {
      deselectAllPoints();
      this.pathId = -1;
    }
  };
  toolPen.updateTail = function(point) {
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
  };
  toolPen.resetHot = function(type, event, mode) {};
  toolPen.testHot = function(type, event, mode) {
    if (mode !== 'tool-pen') {
      return false;
    }
    if (event.modifiers.command) {
      return false;
    }
    if (type === 'keyup') {
      if (event.key === 'enter' || event.key === 'escape') {
        this.closePath();
      }
    }
    return this.hitTest(event, type);
  };
  toolPen.hitTest = function(event, type) {
    const hitSize = 4.0; // paper.view.zoom;
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
  };
  toolPen.on({
    activate: function() {
      $('#tools').children().removeClass('selected');
      $('#tool-pen').addClass('selected');
      setCanvasCursor('cursor-pen-add');
    },
    deactivate: function() {
      if (toolStack.mode !== 'tool-pen') {
        this.closePath();
        updateSelectionState();
      }
      this.currentSegment = undefined;
    },
    mousedown: function(event) {
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

          const values = location.curve.getValues();
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

          const seg = this.hitResult.item.insert(location.index + 1, segment);

          if (!isLinear) {
            seg.previous.handleOut.set(left[2] - left[0], left[3] - left[1]);
            seg.next.handleIn.set(right[4] - right[6], right[5] - right[7]);
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
        this.currentSegment.handleIn.set(0, 0);

        this.mouseStartPos = event.point.clone();
        this.originalHandleIn = this.currentSegment.handleIn.clone();
        this.originalHandleOut = this.currentSegment.handleOut.clone();
      } else if (this.mode === 'adjust') {
        this.currentSegment = this.hitResult.segment;
        this.currentSegment.handleOut.set(0, 0);

        this.mouseStartPos = event.point.clone();
        this.originalHandleIn = this.currentSegment.handleIn.clone();
        this.originalHandleOut = this.currentSegment.handleOut.clone();
      } else if (this.mode === 'continue') {
        if (this.hitResult.segment.index === 0) {
          this.hitResult.item.reverse();
        }

        this.pathId = this.hitResult.item.id;
        this.currentSegment = this.hitResult.segment;
        this.currentSegment.handleOut.set(0, 0);

        this.mouseStartPos = event.point.clone();
        this.originalHandleIn = this.currentSegment.handleIn.clone();
        this.originalHandleOut = this.currentSegment.handleOut.clone();
      } else if (this.mode === 'convert') {
        this.pathId = this.hitResult.item.id;
        this.currentSegment = this.hitResult.segment;
        this.currentSegment.handleIn.set(0, 0);
        this.currentSegment.handleOut.set(0, 0);

        this.mouseStartPos = event.point.clone();
        this.originalHandleIn = this.currentSegment.handleIn.clone();
        this.originalHandleOut = this.currentSegment.handleOut.clone();
      } else if (this.mode === 'join') {
        const path = findItemById(this.pathId);
        if (path !== undefined) {
          const oldPoint = this.hitResult.segment.point.clone();
          if (this.hitResult.segment.index !== 0) {
            this.hitResult.item.reverse();
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
          this.currentSegment.handleIn.set(0, 0);

          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.currentSegment.handleIn.clone();
          this.originalHandleOut = this.currentSegment.handleOut.clone();
        } else {
          this.currentSegment = -1;
        }
      } else if (this.mode === 'remove') {
        if (this.hitResult !== undefined) {
          this.hitResult.item.removeSegment(this.hitResult.segment.index);
          this.hitResult = undefined;
        }
      }

      if (this.currentSegment) {
        this.currentSegment.selected = true;
      }
    },
    mouseup: function(event) {
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
    mousedrag: function(event) {
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
          delta = delta.negate();
        }
        if (dragIn && dragOut) {
          let handlePos = this.originalHandleOut.add(delta);
          if (event.modifiers.shift) {
            handlePos = snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
          }
          this.currentSegment.handleOut = handlePos;
          this.currentSegment.handleIn = handlePos.negate();
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
    mousemove: function(event) {
      this.hitTest(event);
    },
  });

  return toolPen;
}

function updateSelectionState() {
  clearSelectionBounds();
  selectionBounds = getSelectionBounds();
  if (selectionBounds !== undefined) {
    const rect = new paper.Path.Rectangle(selectionBounds);
    // var color = paper.project.activeLayer.getSelectedColor();
    rect.strokeColor = 'rgba(0,0,0,0)'; // color ? color : '#009dec';
    rect.strokeWidth = 1.0 / paper.view.zoom;
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
