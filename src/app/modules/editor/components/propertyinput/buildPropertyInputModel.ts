import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import {
  ColorProperty,
  InterpolatorProperty,
  NameProperty,
  type Property,
} from 'app/modules/editor/model/properties';
import { Animation, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import type { LayerTimelineService } from 'app/modules/editor/services';
import type { State, Store } from 'app/modules/editor/store';
import type { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { SetAnimation } from 'app/modules/editor/store/timeline/actions';
import { find } from 'lodash-es';
import { InspectedProperty, type ValuePreview } from './InspectedProperty';

export interface PropertyInputModel {
  readonly model?: any;
  readonly numSelections: number;
  readonly inspectedProperties: ReadonlyArray<InspectedProperty<any>>;
  // TODO: use a union type here for better type safety?
  readonly icon?: string;
  readonly description?: string;
  readonly subDescription?: string;
  readonly availablePropertyNames: ReadonlyArray<string>;
  /** The inspected layer's properties that can be animated, which get animate buttons. */
  readonly animatablePropertyNames?: ReadonlySet<string>;
  /** The inspected layer's properties that have blocks. */
  readonly animatedPropertyNames?: ReadonlySet<string>;
}

interface Dependencies {
  readonly store: Store<State>;
  readonly layerTimelineService: LayerTimelineService;
  // Tracks values that have been entered into text fields but may not have been saved.
  readonly enteredValueMap: Map<string, any>;
}

const NO_SELECTIONS: PropertyInputModel = {
  numSelections: 0,
  inspectedProperties: [],
  availablePropertyNames: [],
};

/**
 * Builds the properties to show for the selected layers, blocks, or animation.
 */
export function buildPropertyInputModel(
  deps: Dependencies,
  {
    animation,
    isAnimationSelected,
    selectedBlockIds,
    vectorLayer,
    selectedLayerIds,
  }: ReturnType<typeof getPropertyInputState>,
): PropertyInputModel {
  if (selectedLayerIds.size) {
    return buildInspectedLayerProperties(deps, vectorLayer, selectedLayerIds, animation);
  } else if (selectedBlockIds.size) {
    return buildInspectedBlockProperties(deps, vectorLayer, animation, selectedBlockIds);
  } else if (isAnimationSelected) {
    return buildInspectedAnimationProperties(deps, animation);
  }
  return NO_SELECTIONS;
}

export function shouldShowStartActionModeButton(pim: PropertyInputModel) {
  return pim.numSelections === 1 && pim.model instanceof PathAnimationBlock;
}

export function shouldDisableStartActionModeButton(pim: PropertyInputModel) {
  if (!shouldShowStartActionModeButton(pim)) {
    return false;
  }
  const { fromValue, toValue } = pim.model as PathAnimationBlock;
  return !fromValue || !fromValue.getPathString() || !toValue || !toValue.getPathString();
}

export function shouldShowAnimateLayerButton(pim: PropertyInputModel) {
  return (
    pim.availablePropertyNames.length > 0 &&
    pim.numSelections === 1 &&
    (pim.model instanceof VectorLayer ||
      pim.model instanceof GroupLayer ||
      pim.model instanceof ClipPathLayer ||
      pim.model instanceof PathLayer)
  );
}

export function shouldShowInvalidPathAnimationBlockMsg(pim: PropertyInputModel) {
  return (
    pim.numSelections === 1 && pim.model instanceof PathAnimationBlock && !pim.model.isAnimatable()
  );
}

export function isPathBlockFromValueEmpty(block: PathAnimationBlock) {
  return !block.fromValue || !block.fromValue.getPathString();
}

export function isPathBlockToValueEmpty(block: PathAnimationBlock) {
  return !block.toValue || !block.toValue.getPathString();
}

/**
 * Returns the multiplier the color picker's swatch combines with a color's own alpha byte, so the
 * swatch matches what the canvas actually draws (CanvasLayers.ts): a layer's fillAlpha for its
 * fillColor, strokeAlpha for its strokeColor, and 1 for anything else, e.g. the vector layer's
 * canvasColor or a color block's from and to values, none of which have a separate alpha.
 */
export function getColorAlphaMultiplier(model: any, propertyName: string): number {
  if (propertyName === 'fillColor') {
    return model.fillAlpha ?? 1;
  }
  if (propertyName === 'strokeColor') {
    return model.strokeAlpha ?? 1;
  }
  return 1;
}

function buildInspectedLayerProperties(
  deps: Dependencies,

  vl: VectorLayer,
  selectedLayerIds: ReadonlySet<string>,
  animation: Animation,
) {
  const numSelections = selectedLayerIds.size;
  const selectedLayers = Array.from(selectedLayerIds).map(id => vl.findLayerById(id));
  if (numSelections > 1) {
    return {
      numSelections,
      icon: 'collection',
      description: `${numSelections} layers`,
      // TODO: implement batch editting
      inspectedProperties: [],
      availablePropertyNames: [],
    } as PropertyInputModel;
  }
  // Edit a single layer.
  const enteredValueMap = deps.enteredValueMap;
  const layer = selectedLayers[0];
  if (!layer) {
    // The selected layer no longer exists.
    return NO_SELECTIONS;
  }
  const icon = layer.type;
  const description = layer.name;
  const inspectedProperties: InspectedProperty<any>[] = [];
  layer.inspectableProperties.forEach((property, propertyName) => {
    inspectedProperties.push(
      new InspectedProperty<any>(
        layer,
        property,
        propertyName,
        enteredValueMap,
        value => {
          // TODO: avoid dispatching the action if the properties are equal
          const clonedLayer: any = layer.clone();
          clonedLayer[propertyName] = value;
          deps.layerTimelineService.updateLayer(clonedLayer);
        },
        // TODO: return the 'rendered' value if an animation is ongoing? (see AIA)
        undefined,
        enteredValue => {
          if (property instanceof NameProperty) {
            return LayerUtil.getUniqueLayerName([vl], NameProperty.sanitize(enteredValue));
          }
          return enteredValue;
        },
        // TODO: copy AIA conditions to determine whether this should be editable
        undefined,
        buildValuePreview(deps, property, value => {
          const clonedLayer: any = layer.clone();
          clonedLayer[propertyName] = value;
          deps.layerTimelineService.previewLayer(clonedLayer);
        }),
      ),
    );
  });
  const availablePropertyNames = Array.from(
    ModelUtil.getAvailablePropertyNamesForLayer(layer, animation),
  );
  return {
    model: layer,
    numSelections,
    inspectedProperties,
    icon,
    description,
    availablePropertyNames,
    animatablePropertyNames: new Set(layer.animatableProperties.keys()),
    animatedPropertyNames: new Set(
      animation.blocks.filter(b => b.layerId === layer.id).map(b => b.propertyName),
    ),
  } as PropertyInputModel;
}

function buildInspectedBlockProperties(
  deps: Dependencies,

  vl: VectorLayer,
  animation: Animation,
  selectedBlockIds: ReadonlySet<string>,
) {
  const numSelections = selectedBlockIds.size;
  const selectedBlocks = Array.from(selectedBlockIds).map(id => {
    return find(animation.blocks, b => b.id === id);
  });
  if (numSelections > 1) {
    return {
      numSelections,
      icon: 'collection',
      // TODO: implement batch editting
      description: `${numSelections} property animations`,
      inspectedProperties: [],
      availablePropertyNames: [],
    } as PropertyInputModel;
  }
  const enteredValueMap = deps.enteredValueMap;
  const block = selectedBlocks[0];
  if (!block) {
    // The selected block no longer exists.
    return NO_SELECTIONS;
  }
  const icon = 'animationblock';
  const description = block.propertyName;
  const blockLayer = vl.findLayerById(block.layerId);
  const subDescription = blockLayer ? `for '${blockLayer.name}'` : undefined;
  const inspectedProperties: InspectedProperty<any>[] = [];
  block.inspectableProperties.forEach((property, propertyName) => {
    inspectedProperties.push(
      new InspectedProperty<any>(
        block,
        property,
        propertyName,
        enteredValueMap,
        value => {
          // TODO: avoid dispatching the action if the properties are equal
          const clonedBlock: any = block.clone();
          clonedBlock[propertyName] = value;
          deps.layerTimelineService.updateBlocks([clonedBlock]);
        },
        undefined,
        undefined,
        undefined,
        buildValuePreview(deps, property, value => {
          const clonedBlock: any = block.clone();
          clonedBlock[propertyName] = value;
          deps.layerTimelineService.previewBlocks([clonedBlock]);
        }),
      ),
    );
  });
  return {
    model: block,
    numSelections,
    inspectedProperties,
    icon,
    description,
    subDescription,
    availablePropertyNames: [],
  } as PropertyInputModel;
}

/**
 * Returns a preview for the properties that a drag edits, i.e. colors (for a color picker) and
 * interpolators (for the curve editor, which only blocks have). The
 * preview sets the value as it is, without transformEditedValueFn, so a property that needs one
 * (like a layer's name, which must be unique) mustn't get a preview.
 */
function buildValuePreview(
  deps: Dependencies,
  property: Property<any>,
  preview: (value: any) => void,
): ValuePreview<any> | undefined {
  if (!(property instanceof ColorProperty || property instanceof InterpolatorProperty)) {
    return undefined;
  }
  return {
    preview,
    commit: () => deps.layerTimelineService.commitPreview(),
    cancel: () => deps.layerTimelineService.cancelPreview(),
  };
}

function buildInspectedAnimationProperties(deps: Dependencies, animation: Animation) {
  const store = deps.store;
  const enteredValueMap = deps.enteredValueMap;
  const icon = 'animation';
  const description = animation.name;
  const inspectedProperties: InspectedProperty<any>[] = [];
  animation.inspectableProperties.forEach((property, propertyName) => {
    inspectedProperties.push(
      new InspectedProperty<any>(
        animation,
        property,
        propertyName,
        enteredValueMap,
        value => {
          // TODO: avoid dispatching the action if the properties are equal
          const clonedAnimation: any = animation.clone();
          clonedAnimation[propertyName] = value;
          store.dispatch(new SetAnimation(clonedAnimation));
        },
        undefined,
        undefined,
        undefined,
      ),
    );
  });
  return {
    model: animation,
    numSelections: 1,
    inspectedProperties,
    icon,
    description,
    availablePropertyNames: [],
  } as PropertyInputModel;
}
