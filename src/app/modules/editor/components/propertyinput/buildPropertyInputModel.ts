import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { NameProperty } from 'app/modules/editor/model/properties';
import { Animation, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import type { LayerTimelineService } from 'app/modules/editor/services';
import type { State, Store } from 'app/modules/editor/store';
import type { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { SetAnimation } from 'app/modules/editor/store/timeline/actions';
import _ from 'lodash';

import { InspectedProperty } from './InspectedProperty';

export interface PropertyInputModel {
  readonly model?: any;
  readonly numSelections: number;
  readonly inspectedProperties: ReadonlyArray<InspectedProperty<any>>;
  // TODO: use a union type here for better type safety?
  readonly icon?: string;
  readonly description?: string;
  readonly subDescription?: string;
  readonly availablePropertyNames: ReadonlyArray<string>;
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
            const name = NameProperty.sanitize(enteredValue);
            // Keep the current name if the new one is empty, or the same once it's sanitized.
            return !name || name === layer.name
              ? layer.name
              : LayerUtil.getUniqueLayerName([vl], name);
          }
          return enteredValue;
        },
        // TODO: copy AIA conditions to determine whether this should be editable
        undefined,
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
    return _.find(animation.blocks, b => b.id === id);
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
      new InspectedProperty<any>(block, property, propertyName, enteredValueMap, value => {
        // TODO: avoid dispatching the action if the properties are equal
        const clonedBlock: any = block.clone();
        clonedBlock[propertyName] = value;
        deps.layerTimelineService.updateBlocks([clonedBlock]);
      }),
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
        // Keep the current name if the new one is empty once it's sanitized.
        enteredValue =>
          property instanceof NameProperty && !NameProperty.sanitize(enteredValue)
            ? animation.name
            : enteredValue,
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
