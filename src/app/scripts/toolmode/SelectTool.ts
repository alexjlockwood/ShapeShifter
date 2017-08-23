import * as $ from 'jquery';
import * as paper from 'paper';

import { ToolWrapper } from './ToolWrapper';
import * as GuideUtil from './util/GuideUtil';
import * as HoverUtil from './util/HoverUtil';
import * as PaperUtil from './util/PaperUtil';
import * as ToolUtil from './util/ToolUtil';

enum Mode {
  None,
  MoveShapes,
  BoxSelect,
  Scale,
  Rotate,
  CloneShapes,
}

/**
 * A simple selection tool for moving, scaling, rotating, and selecting shapes.
 */
export class SelectTool extends ToolWrapper {
  private boundsPath: paper.Path.Rectangle;
  private boundsScaleHandles: paper.Item[] = [];
  private boundsRotHandles: paper.Item[] = [];

  constructor() {
    super();

    let mode = Mode.None;
    let selectionRect: paper.Path.Rectangle;
    let itemGroup: paper.Group;
    let pivot: paper.Point;
    let corner: paper.Point;
    let origPivot: paper.Point;
    let origSize: paper.Point;
    let origCenter: paper.Point;
    let scaleItems: paper.Item[];

    let rotItems: paper.Item[] = [];
    let rotGroupPivot: paper.Point;
    const prevRot: number[] = [];

    const hitOptions = {
      segments: true,
      stroke: true,
      curves: true,
      fill: true,
      // TODO: figure out which one to use ('guide' or 'guides')
      guides: false,
      guide: false,
      tolerance: 8 / paper.view.zoom,
    } as any; // TODO: missing types

    this.tool.on({
      activate: () => {
        this.setSelectionBounds();
        $(document).on('DeleteItems Undo Grouped Ungrouped SelectionChanged', () => {
          this.setSelectionBounds();
        });
      },
      deactivate: () => {
        HoverUtil.clearHoveredItem();
        this.removeBoundsPath();
        // pg.menu.clearToolEntries();
        $(document).off('DeleteItems Undo Grouped Ungrouped SelectionChanged');
      },
      mousedown: (event: paper.ToolEvent) => {
        scaleItems = undefined;
        HoverUtil.clearHoveredItem();

        const hitResult = paper.project.hitTest(event.point, hitOptions);
        if (hitResult) {
          const { data } = hitResult.item;
          if (data && data.isScaleHandle) {
            mode = Mode.Scale;
            const { index } = data;
            const { bounds } = this.boundsPath;
            pivot = bounds[getOpposingRectCornerNameByIndex(index)].clone();
            origPivot = bounds[getOpposingRectCornerNameByIndex(index)].clone();
            corner = bounds[getRectCornerNameByIndex(index)].clone();
            origSize = corner.subtract(pivot);
            origCenter = bounds.center;
            scaleItems = ToolUtil.getSelectedPaths();
          } else if (data && data.isRotHandle) {
            mode = Mode.Rotate;
            const { bounds } = this.boundsPath;
            rotGroupPivot = bounds.center;
            rotItems = ToolUtil.getSelectedPaths();
            rotItems.forEach((item, i) => (prevRot[i] = event.point.subtract(rotGroupPivot).angle));
          } else {
            // Deselect all by default if the shift key isn't pressed
            // also needs some special love for compound paths and groups,
            // as their children are not marked as "selected".
            if (!event.modifiers.shift) {
              const root = PaperUtil.findParentLayer(hitResult.item);
              if (isGroup(root) || root instanceof paper.CompoundPath) {
                if (!root.selected) {
                  ToolUtil.clearSelection();
                }
              } else if (!hitResult.item.selected) {
                ToolUtil.clearSelection();
              }
            }
            // Deselect a currently selected item if shift is pressed.
            if (event.modifiers.shift && hitResult.item.selected) {
              ToolUtil.setItemSelection(hitResult.item, false);
            } else {
              ToolUtil.setItemSelection(hitResult.item, true);

              if (event.modifiers.alt) {
                mode = Mode.CloneShapes;
                ToolUtil.cloneSelection();
              } else {
                mode = Mode.MoveShapes;
              }
            }
          }
          // While transforming object, never show the bounds stuff.
          this.removeBoundsPath();
        } else {
          if (!event.modifiers.shift) {
            this.removeBoundsPath();
            ToolUtil.clearSelection();
          }
          mode = Mode.BoxSelect;
        }
      },
      mousedrag: (event: paper.ToolEvent) => {
        let modOrigSize = origSize;

        if (mode === Mode.BoxSelect) {
          selectionRect = GuideUtil.rectSelect(event);
          // Remove this rect on the next drag and up event
          selectionRect.removeOnDrag();
        } else if (mode === Mode.Scale) {
          itemGroup = new paper.Group(scaleItems);
          itemGroup.addChild(this.boundsPath);
          itemGroup.data.isHelperItem = true;
          itemGroup.strokeScaling = false;
          itemGroup.applyMatrix = false;

          if (event.modifiers.alt) {
            pivot = origCenter;
            modOrigSize = origSize.multiply(0.5);
          } else {
            pivot = origPivot;
          }

          corner = corner.add(event.delta);
          const size = corner.subtract(pivot);
          let sx = 1;
          let sy = 1;
          if (Math.abs(modOrigSize.x) > 1e-9) {
            sx = size.x / modOrigSize.x;
          }
          if (Math.abs(modOrigSize.y) > 1e-9) {
            sy = size.y / modOrigSize.y;
          }

          if (event.modifiers.shift) {
            const signx = sx > 0 ? 1 : -1;
            const signy = sy > 0 ? 1 : -1;
            sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
            sx *= signx;
            sy *= signy;
          }

          itemGroup.scale(sx, sy, pivot);

          this.boundsScaleHandles.forEach((handle, index) => {
            handle.position = itemGroup.bounds[getRectCornerNameByIndex(index)];
            handle.bringToFront();
          });

          this.boundsRotHandles.forEach((handle, index) => {
            if (!handle) {
              return;
            }
            const cornerName = getRectCornerNameByIndex(index);
            handle.position = itemGroup.bounds[cornerName].add(handle.data.offset);
            handle.bringToFront();
          });
        } else if (mode === Mode.Rotate) {
          let rotAngle = event.point.subtract(rotGroupPivot).angle;

          rotItems.forEach((item, i) => {
            if (!item.data.origRot) {
              item.data.origRot = item.rotation;
            }
            if (event.modifiers.shift) {
              rotAngle = Math.round(rotAngle / 45) * 45;
              item.applyMatrix = false;
              item.pivot = rotGroupPivot;
              item.rotation = rotAngle;
            } else {
              item.rotate(rotAngle - prevRot[i], rotGroupPivot);
            }
            prevRot[i] = rotAngle;
          });
        } else if (mode === Mode.MoveShapes || mode === Mode.CloneShapes) {
          const dragVector = event.point.subtract(event.downPoint);
          const selectedItems = ToolUtil.getSelectedPaths();

          for (const item of selectedItems) {
            // add the position of the item before the drag started
            // for later use in the snap calculation
            if (!item.data.origPos) {
              item.data.origPos = item.position;
            }

            if (event.modifiers.shift) {
              item.position = item.data.origPos.add(
                ToolUtil.snapDeltaToAngle(dragVector, Math.PI * 2 / 8),
              );
            } else {
              item.position = item.position.add(event.delta);
            }
          }
        }
      },
      mousemove: (event: paper.ToolEvent) => HoverUtil.handleHoveredItem(hitOptions, event),
      mouseup: (event: paper.ToolEvent) => {
        if (mode === Mode.BoxSelect && selectionRect) {
          ToolUtil.processRectangularSelection(event, selectionRect);
          selectionRect.remove();
        } else if (mode === Mode.MoveShapes || mode === Mode.CloneShapes) {
          // Resetting the items origin point for the next usage.
          const selectedItems = ToolUtil.getSelectedPaths();

          selectedItems.forEach(item => {
            // Remove the orig pos again.
            item.data.origPos = undefined;
          });
        } else if (mode === Mode.Scale) {
          itemGroup.applyMatrix = true;
          itemGroup.layer.addChildren(itemGroup.children);
          itemGroup.remove();
        } else if (mode === Mode.Rotate) {
          rotItems.forEach(item => (item.applyMatrix = true));
        }

        mode = Mode.None;
        selectionRect = undefined;

        if (ToolUtil.getSelectedPaths().length <= 0) {
          this.removeBoundsPath();
        } else {
          this.setSelectionBounds();
        }
      },
      // TODO: deal with key events?
    });
  }

  private setSelectionBounds() {
    this.removeBoundsPath();

    const items = ToolUtil.getSelectedPaths();
    if (items.length === 0) {
      return;
    }

    let rect: paper.Rectangle;
    items.forEach(item => {
      if (rect) {
        rect = rect.unite(item.bounds);
      } else {
        rect = item.bounds;
      }
    });

    if (!this.boundsPath) {
      this.boundsPath = new paper.Path.Rectangle(rect);
      this.boundsPath.curves[0].divideAtTime(0.5);
      this.boundsPath.curves[2].divideAtTime(0.5);
      this.boundsPath.curves[4].divideAtTime(0.5);
      this.boundsPath.curves[6].divideAtTime(0.5);
    }
    this.boundsPath.guide = true;
    this.boundsPath.data.isSelectionBound = true;
    this.boundsPath.data.isHelperItem = true;
    this.boundsPath.fillColor = undefined;
    this.boundsPath.strokeScaling = false;
    this.boundsPath.fullySelected = true;
    this.boundsPath.parent = PaperUtil.findGuideLayer();

    this.boundsPath.segments.forEach((segment, index) => {
      let size = 4;

      if (index % 2 === 0) {
        size = 6;
      }

      if (index === 7) {
        const offset = new paper.Point(0, 10 / paper.view.zoom);
        // TODO: this is a bit hacky... we shouldn't be blindly setting the index like this
        // TODO: provide different mechanism for rotating shapes
        this.boundsRotHandles[index] = new paper.Path.Circle({
          center: segment.point.add(offset),
          data: {
            offset: offset,
            isRotHandle: true,
            isHelperItem: true,
            noSelect: true,
            noHover: true,
          },
          radius: 5 / paper.view.zoom,
          strokeColor: GuideUtil.getGuideColor('blue'),
          fillColor: 'white',
          strokeWidth: 0.5 / paper.view.zoom,
          parent: PaperUtil.findGuideLayer(),
        });
      }

      // TODO: this is a bit hacky... we shouldn't be blindly setting the index like this
      this.boundsScaleHandles[index] = new paper.Path.Rectangle({
        center: segment.point,
        data: {
          index,
          isScaleHandle: true,
          isHelperItem: true,
          noSelect: true,
          noHover: true,
        },
        size: [size / paper.view.zoom, size / paper.view.zoom],
        fillColor: GuideUtil.getGuideColor('blue'),
        parent: PaperUtil.findGuideLayer(),
      });
    });
  }

  private removeBoundsPath() {
    GuideUtil.removeHelperItems();
    this.boundsPath = undefined;
    this.boundsScaleHandles = [];
    this.boundsRotHandles = [];
  }
}

type CornerNameType =
  | 'bottomLeft'
  | 'leftCenter'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'rightCenter'
  | 'bottomRight'
  | 'bottomCenter';

const rectCornerNames: ReadonlyArray<CornerNameType> = [
  'bottomLeft',
  'leftCenter',
  'topLeft',
  'topCenter',
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
];

function getRectCornerNameByIndex(index: number) {
  return rectCornerNames[index];
}

const opposingRectCornerNames: ReadonlyArray<CornerNameType> = [
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
  'bottomLeft',
  'leftCenter',
  'topLeft',
  'topCenter',
];

function getOpposingRectCornerNameByIndex(index: number) {
  return opposingRectCornerNames[index];
}

// TODO: make use of this function!
// var preProcessSelection = function() {
//   // when switching to the select tool while having a child object of a
//   // compound path selected, deselect the child and select the compound path
//   // instead. (otherwise the compound path breaks because of scale-grouping)
//   var items = pg.selection.getSelectedItems();
//   jQuery.each(items, function(index, item) {
//     if(pg.compoundPath.isCompoundPathChild(item)) {
//       var cp = pg.compoundPath.getItemsCompoundPath(item);
//       pg.selection.setItemSelection(item, false);
//       pg.selection.setItemSelection(cp, true);
//     }
//   });
//   setSelectionBounds();
// };

function isGroup(item: paper.Item) {
  return item && item.className && item.className === 'Group';
}
