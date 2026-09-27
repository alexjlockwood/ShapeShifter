import type {
  CanvasEditorCommand,
  CanvasEditorMenuState,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import { POINT_TYPE_OPTIONS } from 'app/modules/editor/components/canvas/pointTypes';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import type { Animation } from 'app/modules/editor/model/timeline';
import {
  getBrokenApartLayerIds,
  getCombinedLayerIds,
} from 'app/modules/editor/scripts/common/combineLayers';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import {
  getMergedLayerIds,
  getOutlineLayerIds,
  getStrokedPathIds,
  hasBlocks,
  type LayerDocument,
} from 'app/modules/editor/scripts/common/pathOpLayers';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import { Duration } from 'app/modules/editor/services/snackbar.service';

import type { ContextMenuTarget } from './contextmenu.service';

// The context menu's items, for the canvas and the layer list (ContextMenuHost.tsx). They're built
// from plain data when the menu opens, so the rules for what's offered, and why an item is
// disabled, live here rather than in the components, and are unit tested.

export interface ContextMenuItem {
  /** Unique among its siblings, e.g. 'group' or 'animate.rotation'. */
  readonly id: string;
  readonly label: string;
  /**
   * The keyboard shortcut that does the same, as in the editor's toolbars: keys joined by '+',
   * with Command for Cmd on a Mac and Ctrl elsewhere (formatShortcut).
   */
  readonly shortcut?: string;
  /** Why the item can't run now. The item is disabled if it's set, even to ''. */
  readonly disabledReason?: string;
  /** Opens a submenu of these, rather than running something. */
  readonly submenu?: ReadonlyArray<ContextMenuItem>;
  /** Runs the item, once the menu has closed. */
  readonly run?: () => void;
}

/** A group of items, with dividers between groups. */
export type ContextMenuSection = ReadonlyArray<ContextMenuItem>;

export interface ContextMenuInput {
  /** The layers and animation as they're saved (not a preview). */
  readonly document: LayerDocument;
  readonly selectedLayerIds: ReadonlySet<string>;
  readonly target: ContextMenuTarget;
  /** What the canvas editor reports, or undefined if it isn't loaded, as on the live site. */
  readonly editor: CanvasEditorMenuState | undefined;
}

export type ContextMenuServices = Pick<
  EditorServices,
  'layerTimelineService' | 'canvasEditorBridgeService' | 'snackBarService'
>;

/**
 * Builds one section of the menu, or an empty list if none of its items apply. New kinds of
 * items (e.g. for the points of the path being edited) go in a section of their own, added to
 * CONTEXT_MENU_SECTIONS.
 */
export type ContextMenuSectionBuilder = (
  input: ContextMenuInput,
  services: ContextMenuServices,
) => ContextMenuSection;

/**
 * Returns the menu's sections for the selection, leaving out the empty ones. While the editor is
 * in the middle of something that a command would throw away, like the pen drawing a path, the
 * menu only says so.
 */
export function buildContextMenu(
  input: ContextMenuInput,
  services: ContextMenuServices,
  sectionBuilders: ReadonlyArray<ContextMenuSectionBuilder> = CONTEXT_MENU_SECTIONS,
): ReadonlyArray<ContextMenuSection> {
  const busyReason = input.editor?.busyReason;
  if (busyReason) {
    return [[{ id: 'busy', label: busyReason, disabledReason: '' }]];
  }
  const selectedLayers = getSelectedLayers(input);
  if (!selectedLayers.length) {
    return [buildEmptySelectionSection(input, services)];
  }
  return sectionBuilders.map(build => build(input, services)).filter(section => section.length > 0);
}

/** Select all, which is what there is to do with nothing selected. */
function buildEmptySelectionSection(
  { document }: ContextMenuInput,
  { layerTimelineService }: ContextMenuServices,
): ContextMenuSection {
  return [
    {
      id: 'selectAll',
      label: 'Select all',
      shortcut: 'Command+A',
      disabledReason: document.vectorLayer.children.length ? undefined : 'There are no layers',
      run: () => layerTimelineService.selectAllLayers(),
    },
  ];
}

/**
 * The selected points' commands, while a path's points are edited: Delete, the point type, Open or
 * Close subpath, and Set as first point. They run in the canvas editor, as their keys do.
 */
export const buildPointSection: ContextMenuSectionBuilder = (
  { editor },
  { canvasEditorBridgeService },
) => {
  const points = editor?.points;
  if (!points) {
    return [];
  }
  const { selectedCount, pointType, isSubPathClosed } = points;
  return [
    {
      id: 'deletePoints',
      label: selectedCount === 1 ? 'Delete point' : 'Delete points',
      run: () => canvasEditorBridgeService.runPointCommand({ type: 'delete' }),
    },
    {
      id: 'pointType',
      label: 'Point type',
      submenu: POINT_TYPE_OPTIONS.map((option, i) => ({
        id: `pointType.${option.value}`,
        label: option.value === pointType ? `${option.label} (current)` : option.label,
        shortcut: String(i + 1),
        run: () =>
          canvasEditorBridgeService.runPointCommand({
            type: 'setPointType',
            pointType: option.value,
          }),
      })),
    },
    {
      id: 'toggleClosed',
      label: isSubPathClosed ? 'Open subpath' : 'Close subpath',
      disabledReason: points.toggleClosedReason,
      run: () => canvasEditorBridgeService.runPointCommand({ type: 'toggleClosed' }),
    },
    {
      id: 'setFirstPoint',
      label: 'Set as first point',
      disabledReason: points.setFirstReason,
      run: () => canvasEditorBridgeService.runPointCommand({ type: 'setFirstPoint' }),
    },
  ];
};

/**
 * Duplicate (which only the canvas editor does), Group, Ungroup, Flatten group, and Convert to
 * clip path or path.
 */
export const buildLayerSection: ContextMenuSectionBuilder = (input, services) => [
  ...(input.editor ? [editorItem(services, 'duplicate', 'Duplicate', 'Command+D')] : []),
  ...getGroupItems(input, services),
  ...getConvertItems(input, services),
];

function getGroupItems(input: ContextMenuInput, { layerTimelineService }: ContextMenuServices) {
  const selectedLayers = getSelectedLayers(input);
  const items: ContextMenuItem[] = [];
  if (selectedLayers.some(layer => !(layer instanceof VectorLayer))) {
    items.push({
      id: 'group',
      label: 'Group',
      shortcut: 'Command+G',
      run: () => layerTimelineService.groupOrUngroupSelectedLayers(true),
    });
  }
  if (selectedLayers.some(layer => layer instanceof GroupLayer)) {
    items.push({
      id: 'ungroup',
      label: 'Ungroup',
      shortcut: 'Command+Shift+G',
      run: () => layerTimelineService.groupOrUngroupSelectedLayers(false),
    });
  }
  const [layer] = selectedLayers;
  if (selectedLayers.length === 1 && layer instanceof GroupLayer) {
    items.push({
      id: 'flatten',
      label: 'Flatten group',
      disabledReason: getFlattenRefusal(layer, input.document.animation),
      run: () => layerTimelineService.flattenGroupLayer(layer.id),
    });
  }
  return items;
}

/** Combine, Break apart, and the canvas editor's boolean operations and outline stroke. */
export const buildPathSection: ContextMenuSectionBuilder = (input, services) => {
  const { document, selectedLayerIds, editor } = input;
  const { layerTimelineService, snackBarService } = services;
  const showRefusal = (reason: string | undefined) => {
    if (reason) {
      snackBarService.show(reason, 'Dismiss', Duration.Long);
    }
  };
  const items: ContextMenuItem[] = [];
  const combined = getCombinedLayerIds(document, selectedLayerIds);
  if (combined) {
    items.push({
      id: 'combine',
      label: 'Combine into one path',
      disabledReason: combined.reason,
      run: () => showRefusal(layerTimelineService.combineSelectedLayers()),
    });
  }
  const brokenApart = getBrokenApartLayerIds(document, selectedLayerIds);
  if (brokenApart) {
    items.push({
      id: 'breakApart',
      label: 'Break apart',
      disabledReason: brokenApart.reason,
      run: () => showRefusal(layerTimelineService.breakApartSelectedLayers()),
    });
  }
  if (!editor) {
    return items;
  }
  const merged = getMergedLayerIds(document, selectedLayerIds);
  if (merged) {
    items.push({
      id: 'boolean',
      label: 'Boolean operation',
      disabledReason: merged.reason,
      submenu: [
        editorItem(services, 'union', 'Union', 'Alt+Shift+U'),
        editorItem(services, 'subtract', 'Subtract', 'Alt+Shift+S'),
        editorItem(services, 'intersect', 'Intersect', 'Alt+Shift+I'),
        editorItem(services, 'exclude', 'Exclude', 'Alt+Shift+E'),
      ],
    });
  }
  // Only for paths with a stroke, and not yet for animated ones, whose width, trim, and path
  // would stop animating.
  if (getStrokedPathIds(document, selectedLayerIds).length) {
    items.push({
      ...editorItem(services, 'outline', 'Outline stroke', 'Command+Alt+O'),
      disabledReason: getOutlineLayerIds(document, selectedLayerIds)
        ? undefined
        : "Outline stroke doesn't work on animated paths yet",
    });
  }
  return items;
};

function getConvertItems(input: ContextMenuInput, { layerTimelineService }: ContextMenuServices) {
  const selectedLayers = getSelectedLayers(input);
  const [layer] = selectedLayers;
  if (selectedLayers.length !== 1 || !isConvertible(layer)) {
    return [];
  }
  const items: ContextMenuItem[] = [
    {
      id: 'convert',
      label: layer instanceof PathLayer ? 'Convert to clip path' : 'Convert to path',
      disabledReason: getConvertRefusal(layer, input.document.animation),
      run: () => layerTimelineService.convertLayer(layer.id),
    },
  ];
  return items;
}

/** Animate, with the properties of the layer that aren't animated yet. */
export const buildAnimateSection: ContextMenuSectionBuilder = (input, { layerTimelineService }) => {
  const selectedLayers = getSelectedLayers(input);
  const [layer] = selectedLayers;
  if (selectedLayers.length !== 1) {
    return [];
  }
  const propertyNames = Array.from(
    ModelUtil.getAvailablePropertyNamesForLayer(layer, input.document.animation),
  );
  if (!propertyNames.length) {
    return [];
  }
  return [
    {
      id: 'animate',
      label: 'Animate',
      submenu: propertyNames.map(propertyName => ({
        id: `animate.${propertyName}`,
        // The property's own name, as in the layer list's "Animate this layer" menu.
        label: propertyName,
        run: () => layerTimelineService.addBlockForProperty(layer.id, propertyName),
      })),
    },
  ];
};

/** Delete, for the selected layers, unless selected points have their own (buildPointSection). */
export const buildDeleteSection: ContextMenuSectionBuilder = (
  { editor },
  { layerTimelineService },
) =>
  editor?.points
    ? []
    : [
        {
          id: 'delete',
          label: 'Delete',
          run: () => layerTimelineService.deleteSelectedModels(),
        },
      ];

/** The menu's sections, in order. */
export const CONTEXT_MENU_SECTIONS: ReadonlyArray<ContextMenuSectionBuilder> = [
  buildPointSection,
  buildLayerSection,
  buildPathSection,
  buildAnimateSection,
  buildDeleteSection,
];

/**
 * Returns why the group can't be flattened, or undefined if it can. Its children take its
 * transform, which only works if neither it nor the groups in it are animated.
 */
export function getFlattenRefusal(group: GroupLayer, animation: Animation) {
  if (!group.children.length) {
    return 'The group is empty';
  }
  if (hasBlocks(animation, group.id)) {
    return "The group's transform is animated";
  }
  const animatedChild = group.children.find(
    child => child instanceof GroupLayer && hasBlocks(animation, child.id),
  );
  return animatedChild ? `${animatedChild.name}'s transform is animated` : undefined;
}

/**
 * Returns why the path or clip path can't be converted to the other, or undefined if it can. A
 * clip path only has a path, so a path's other animations would be lost.
 */
export function getConvertRefusal(layer: PathLayer | ClipPathLayer, animation: Animation) {
  if (layer instanceof ClipPathLayer) {
    return undefined;
  }
  const clipPathProperties = new Set(
    new ClipPathLayer({ name: '', children: [], pathData: undefined }).animatableProperties.keys(),
  );
  const lost = new Set(
    animation.blocks
      .filter(block => block.layerId === layer.id && !clipPathProperties.has(block.propertyName))
      .map(block => block.propertyName),
  );
  return lost.size ? `Clip paths can't animate ${Array.from(lost).join(', ')}` : undefined;
}

function isConvertible(layer: Layer | undefined): layer is PathLayer | ClipPathLayer {
  return layer instanceof PathLayer || layer instanceof ClipPathLayer;
}

/** An item that runs a command in the canvas editor. */
function editorItem(
  { canvasEditorBridgeService }: ContextMenuServices,
  command: CanvasEditorCommand,
  label: string,
  shortcut: string,
): ContextMenuItem {
  return { id: command, label, shortcut, run: () => canvasEditorBridgeService.runCommand(command) };
}

function getSelectedLayers({ document, selectedLayerIds }: ContextMenuInput) {
  const vl = document.vectorLayer;
  return Array.from(selectedLayerIds)
    .map(id => vl.findLayerById(id))
    .filter(layer => layer !== undefined);
}

/**
 * Returns the shortcut the way the app's tooltips show it, e.g. 'Cmd+Shift+G' on a Mac and
 * 'Ctrl+Shift+G' elsewhere.
 */
export function formatShortcut(shortcut: string, isMac: boolean) {
  return shortcut.replace('Command', isMac ? 'Cmd' : 'Ctrl');
}
