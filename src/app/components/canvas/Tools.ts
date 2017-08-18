import * as $ from 'jquery';
import * as paper from 'paper';

let clipboard = null;

let selectionBounds = null;
let selectionBoundsShape = null;
let drawSelectionBounds = 0;

export function createToolSelect() {
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
  toolSelect.mode = null;
  toolSelect.hitItem = null;
  toolSelect.originalContent = null;
  toolSelect.changed = false;
  toolSelect.duplicates = null;

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
    this.duplicates = null;
  };

  toolSelect.resetHot = function(type, event, mode) {};
  toolSelect.testHot = function(type, event, mode) {
    /*	if (mode != 'tool-select')
		return false;*/
    return this.hitTest(event);
  };
  toolSelect.hitTest = function(event) {
    const hitSize = 4.0; // / paper.view.zoom;
    this.hitItem = null;

    // Hit test items.
    if (event.point) {
      this.hitItem = paper.project.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    if (this.hitItem) {
      if (this.hitItem.type == 'fill' || this.hitItem.type == 'stroke') {
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
      this.mode = null;
      this.changed = false;

      if (this.hitItem) {
        if (this.hitItem.type == 'fill' || this.hitItem.type == 'stroke') {
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
      if (this.mode == 'move-shapes') {
        if (this.changed) {
          clearSelectionBounds();
          // undo.snapshot('Move Shapes');
        }
        this.duplicates = null;
      } else if (this.mode == 'box-select') {
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
      if (this.mode == 'move-shapes') {
        this.changed = true;

        if (event.modifiers.option) {
          if (this.duplicates == null) {
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
      } else if (this.mode == 'box-select') {
        dragRect(this.mouseStartPos, event.point);
      }
    },
    mousemove: function(event) {
      this.hitTest(event);
    },
  });

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
    if (drawSelectionBounds == 0) {
      if (selectionBoundsShape) {
        selectionBoundsShape.visible = false;
      }
    }
  }

  return toolSelect as paper.Tool;
}

export function createToolDirectSelect() {
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
  toolDirectSelect.mode = null;
  toolDirectSelect.hitItem = null;
  toolDirectSelect.originalContent = null;
  toolDirectSelect.originalHandleIn = null;
  toolDirectSelect.originalHandleOut = null;
  toolDirectSelect.changed = false;

  toolDirectSelect.resetHot = function(type, event, mode) {};
  toolDirectSelect.testHot = function(type, event, mode) {
    if (mode != 'tool-direct-select') return;
    return this.hitTest(event);
  };

  toolDirectSelect.hitTest = function(event) {
    var hitSize = 4.0; // / paper.view.zoom;
    var hit = null;
    this.hitItem = null;

    // Hit test items.
    if (event.point) {
      this.hitItem = paper.project.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    // Hit test selected handles
    hit = null;
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
    hit = null;
    if (event.point) {
      hit = paper.project.hitTest(event.point, { segments: true, tolerance: hitSize });
    }
    if (hit) {
      this.hitItem = hit;
    }

    if (this.hitItem) {
      if (this.hitItem.type == 'fill' || this.hitItem.type == 'stroke') {
        if (this.hitItem.item.selected) {
          setCanvasCursor('cursor-arrow-small');
        } else {
          setCanvasCursor('cursor-arrow-white-shape');
        }
      } else if (
        this.hitItem.type == 'segment' ||
        this.hitItem.type == 'handle-in' ||
        this.hitItem.type == 'handle-out'
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
      // this.hitItem = null;
    },
    deactivate: function() {
      // this.clearSelectionBounds();
    },
    mousedown: function(event) {
      this.mode = null;
      this.changed = false;

      if (this.hitItem) {
        if (this.hitItem.type == 'fill' || this.hitItem.type == 'stroke') {
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
        } else if (this.hitItem.type == 'segment') {
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
        } else if (this.hitItem.type == 'handle-in' || this.hitItem.type == 'handle-out') {
          this.mode = 'move-handle';
          this.mouseStartPos = event.point.clone();
          this.originalHandleIn = this.hitItem.segment.handleIn.clone();
          this.originalHandleOut = this.hitItem.segment.handleOut.clone();

          /*				if (this.hitItem.type == 'handle-out') {
					this.originalHandlePos = this.hitItem.segment.handleOut.clone();
					this.originalOppHandleLength = this.hitItem.segment.handleIn.length;
				} else {
					this.originalHandlePos = this.hitItem.segment.handleIn.clone();
					this.originalOppHandleLength = this.hitItem.segment.handleOut.length;
				}*/
          //				this.originalContent = captureSelectionState(); // For some reason this does not work!
        }
        updateSelectionState();
      } else {
        // Clicked on and empty area, engage box select.
        this.mouseStartPos = event.point.clone();
        this.mode = 'box-select';
      }
    },
    mouseup: function(event) {
      if (this.mode == 'move-shapes') {
        if (this.changed) {
          clearSelectionBounds();
          // undo.snapshot('Move Shapes');
        }
      } else if (this.mode == 'move-points') {
        if (this.changed) {
          clearSelectionBounds();
          // undo.snapshot('Move Points');
        }
      } else if (this.mode == 'move-handle') {
        if (this.changed) {
          clearSelectionBounds();
          // undo.snapshot('Move Handle');
        }
      } else if (this.mode == 'box-select') {
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
      if (this.mode == 'move-shapes') {
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
      } else if (this.mode == 'move-points') {
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
      } else if (this.mode == 'move-handle') {
        const delta = event.point.subtract(this.mouseStartPos);

        if (this.hitItem.type == 'handle-out') {
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
      } else if (this.mode == 'box-select') {
        dragRect(this.mouseStartPos, event.point);
      }
    },
    mousemove: function(event) {
      this.hitTest(event);
    },
  });

  return toolDirectSelect as paper.Tool;
}

function updateSelectionState() {
  clearSelectionBounds();
  selectionBounds = getSelectionBounds();
  if (selectionBounds != null) {
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
  selectionBoundsShape = null;
  selectionBounds = null;
}

function updateSelectionUI() {
  if (selectionBounds == null) {
    $('#cut').addClass('disabled');
    $('#copy').addClass('disabled');
    $('#delete').addClass('disabled');
  } else {
    $('#cut').removeClass('disabled');
    $('#copy').removeClass('disabled');
    $('#delete').removeClass('disabled');
  }

  if (clipboard == null) {
    $('#paste').addClass('disabled');
  } else {
    $('#paste').removeClass('disabled');
  }
}

// Returns bounding box of all selected items.
function getSelectionBounds() {
  let bounds = null;
  const selected = (paper.project as any).selectedItems;
  for (const item of selected) {
    if (bounds == null) {
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

  for (var i = 0, l = paper.project.layers.length; i < l; i++) {
    var layer = paper.project.layers[i];
    checkPathItem(layer);
  }

  boundingRect.remove();

  return paths;
}

function setCanvasCursor(name) {
  $('#canvas')
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

function findItemById(id) {
  if (id == -1) {
    return null;
  }
  function findItem(item) {
    if (item.id == id) {
      return item;
    }
    if (item.children) {
      for (let j = item.children.length - 1; j >= 0; j--) {
        const it = findItem(item.children[j]);
        if (it != null) {
          return it;
        }
      }
    }
    return null;
  }

  for (let i = 0, l = paper.project.layers.length; i < l; i++) {
    const layer = paper.project.layers[i];
    const it = findItem(layer);
    if (it != null) {
      return it;
    }
  }
  return null;
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
