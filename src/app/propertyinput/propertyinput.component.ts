import { ColorUtil, ModelUtil } from '../scripts/common';
import { LayerUtil, VectorLayer } from '../scripts/layers';
import { FractionProperty, NameProperty, Option, Property } from '../scripts/properties';
import { Animation, PathAnimationBlock } from '../scripts/timeline';
import {
  ReplaceAnimations,
  ReplaceBlocks,
  ReplaceLayer,
  StartActionMode,
  State,
  Store,
} from '../store';
import { getPropertyInputState } from '../store/common/selectors';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-propertyinput',
  templateUrl: './propertyinput.component.html',
  styleUrls: ['./propertyinput.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyInputComponent implements OnInit {

  propertyInputModel$: Observable<PropertyInputModel>;

  // Map used to track user state that has been entered into textfields
  // but may not have been saved in the store.
  private readonly enteredValueMap = new Map<string, any>();

  constructor(private readonly store: Store<State>) { }

  ngOnInit() {
    this.propertyInputModel$ =
      this.store.select(getPropertyInputState).map(({
        animations,
        selectedAnimationIds,
        selectedBlockIds,
        vectorLayers,
        selectedLayerIds,
      }) => {
        if (selectedLayerIds.size) {
          return this.buildInspectedLayerProperties(vectorLayers, selectedLayerIds);
        } else if (selectedBlockIds.size) {
          return this.buildInspectedBlockProperties(vectorLayers, animations, selectedBlockIds);
        } else if (selectedAnimationIds.size) {
          return this.buildInspectedAnimationProperties(animations, selectedAnimationIds);
        } else {
          return { numSelections: 0, inspectedProperties: [] };
        }
      });
  }

  shouldShowShapeShifterButton(model: PropertyInputModel) {
    return model.numSelections === 1 && model.model instanceof PathAnimationBlock;
  }

  onShapeShifterModeClick(blockId: string) {
    this.store.dispatch(new StartActionMode(blockId));
  }

  valueEditorKeyDown(event: KeyboardEvent, ip: InspectedProperty<any>) {
    switch (event.keyCode) {
      // Up/down arrow buttons.
      case 38:
      case 40:
        ip.resolveEnteredValue();
        const $target = $(event.target);
        const numberValue = Number($target.val());
        if (isNaN(numberValue)) {
          break;
        }
        let delta = (event.keyCode === 38) ? 1 : -1;

        if (ip.property instanceof FractionProperty) {
          delta *= .1;
        }

        if (event.shiftKey) {
          // TODO: make this more obvious somehow
          delta *= 10;
        } else if (event.altKey) {
          // TODO: make this more obvious somehow
          delta /= 10;
        }

        ip.property.setEditableValue(ip, 'value', Number((numberValue + delta).toFixed(6)));
        setTimeout(() => ($target.get(0) as HTMLInputElement).select(), 0);
        return false;
    }
    return undefined;
  }

  private buildInspectedLayerProperties(
    vls: ReadonlyArray<VectorLayer>,
    selectedLayerIds: Set<string>,
  ) {
    const numSelections = selectedLayerIds.size;
    const selectedLayers =
      Array.from(selectedLayerIds).map(id => LayerUtil.findLayerById(vls, id));
    if (numSelections > 1) {
      return {
        numSelections,
        icon: 'collection',
        description: `${numSelections} layers`,
        // TODO: implement batch editting
        inspectedProperties: [],
      } as PropertyInputModel;
    }
    // Edit a single layer.
    const store = this.store;
    const enteredValueMap = this.enteredValueMap;
    const layer = selectedLayers[0];
    const icon = layer.getIconName();
    const description = layer.name;
    const inspectedProperties: InspectedProperty<any>[] = [];
    layer.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(new InspectedProperty<any>(
        layer,
        property,
        propertyName,
        enteredValueMap,
        (value) => {
          const clonedLayer = layer.clone();
          clonedLayer[propertyName] = value;
          store.dispatch(new ReplaceLayer(clonedLayer));
        },
        // TODO: return the 'rendered' value if an animation is ongoing? (see AIA)
        undefined,
        (enteredValue) => {
          if (property instanceof NameProperty) {
            return ModelUtil.getUniqueLayerName(
              vls, NameProperty.sanitize(enteredValue));
          }
          return enteredValue;
        },
        // TODO: copy AIA conditions to determine whether this should be editable
        undefined,
      ));
    });
    return {
      model: layer,
      numSelections,
      inspectedProperties,
      icon,
      description,
    } as PropertyInputModel;
  }

  private buildInspectedBlockProperties(
    vectorLayers: ReadonlyArray<VectorLayer>,
    animations: ReadonlyArray<Animation>,
    selectedBlockIds: Set<string>,
  ) {
    const numSelections = selectedBlockIds.size;
    const selectedBlocks = Array.from(selectedBlockIds).map(id => {
      for (const anim of animations) {
        const block = _.find(anim.blocks, b => b.id === id);
        if (block) {
          return block;
        }
      }
      throw new Error('Could not find selected block ID');
    });
    if (numSelections > 1) {
      return {
        numSelections,
        icon: 'collection',
        // TODO: implement batch editting
        description: `${numSelections} property animations`,
        inspectedProperties: [],
      } as PropertyInputModel;
    }
    const store = this.store;
    const enteredValueMap = this.enteredValueMap;
    const block = selectedBlocks[0];
    const icon = 'animationblock';
    const description = block.propertyName;
    const blockLayer = LayerUtil.findLayerById(vectorLayers, block.layerId);
    const subDescription = `for '${blockLayer.name}'`;
    const inspectedProperties: InspectedProperty<any>[] = [];
    block.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(new InspectedProperty<any>(
        block,
        property,
        propertyName,
        enteredValueMap,
        (value) => {
          const clonedBlock = block.clone();
          clonedBlock[propertyName] = value;
          store.dispatch(new ReplaceBlocks([clonedBlock]));
        },
      ));
    });
    return {
      model: block,
      numSelections,
      inspectedProperties,
      icon,
      description,
      subDescription,
    } as PropertyInputModel;
  }

  private buildInspectedAnimationProperties(
    animations: ReadonlyArray<Animation>,
    selectedAnimationIds: Set<string>,
  ) {
    const numSelections = selectedAnimationIds.size;
    const selectedAnimations = Array.from(selectedAnimationIds).map(id => {
      return _.find(animations, animation => animation.id === id);
    });
    if (numSelections > 1) {
      return {
        numSelections,
        description: `${numSelections} animations`,
        // TODO: implement batch editting
        inspectedProperties: [],
      } as PropertyInputModel;
    }
    const store = this.store;
    const enteredValueMap = this.enteredValueMap;
    const animation = selectedAnimations[0];
    const icon = 'animation';
    const description = animation.name;
    const inspectedProperties: InspectedProperty<any>[] = [];
    animation.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(new InspectedProperty<any>(
        animation,
        property,
        propertyName,
        enteredValueMap,
        (value) => {
          const clonedAnimation = animation.clone();
          clonedAnimation[propertyName] = value;
          store.dispatch(new ReplaceAnimations([clonedAnimation]));
        },
        undefined,
        (enteredValue) => {
          if (property instanceof NameProperty) {
            return ModelUtil.getUniqueAnimationName(
              animations, NameProperty.sanitize(enteredValue));
          }
          return enteredValue;
        },
        undefined,
      ));
    });
    return {
      model: animation,
      numSelections,
      inspectedProperties,
      icon,
      description,
    } as PropertyInputModel;
  }

  // Called from the HTML template.
  androidToCssColor(color: string) {
    return ColorUtil.androidToCssHexColor(color);
  }

  trackInspectedPropertyFn(index: number, ip: InspectedProperty<any>) {
    return ip.propertyName;
  }

  trackEnumOptionFn(index: number, option: Option) {
    return option.value;
  }
}

// TODO: use this for batch editing
// function getSharedPropertyNames(items: ReadonlyArray<Inspectable>) {
//   if (!items || !items.length) {
//     return [];
//   }
//   let shared: ReadonlyArray<string>;
//   items.forEach(item => {
//     const names = Array.from(item.inspectableProperties.keys());
//     if (!shared) {
//       shared = names;
//     } else {
//       shared = shared.filter(n => names.includes(n));
//     }
//   });
//   return shared;
// }

/**
 * Stores information about an inspected property.
 * V is the property value type (number, string, or path).
 */
class InspectedProperty<V> {
  public readonly typeName: string;

  constructor(
    // The model object being inspected (a layer, animation, or animation block).
    private readonly model: any,
    // The model object's inspected property.
    public readonly property: Property<V>,
    // The model object's inspected property name.
    public readonly propertyName: string,
    // The in-memory entered value map.
    private readonly enteredValueMap: Map<string, any>,
    // Stores the model's entered value for the given property name in the application store.
    private readonly setValueFn: (value: V) => void,
    // Returns the value associated with this model's property name.
    private readonly getValueFn = () => model[propertyName],
    // Provides an opportunity to edit the value before it is set.
    private readonly transformEditedValueFn = (enteredValue: V) => enteredValue,
    // Returns whether or not this property name is editable.
    public readonly isEditable = () => true,
  ) {
    this.typeName = this.property.constructor.name;
  }

  get value() {
    return this.getValueFn();
  }

  set value(value: V) {
    this.setValueFn(value);
  }

  getDisplayValue() {
    return this.property.displayValueForValue(this.value);
  }

  get editableValue() {
    const enteredValue = this.getEnteredValue();
    return enteredValue === undefined
      ? this.property.getEditableValue(this, 'value')
      : enteredValue;
  }

  set editableValue(enteredValue: V) {
    this.setEnteredValue(enteredValue);
    enteredValue = this.transformEditedValueFn(enteredValue);
    this.property.setEditableValue(this, 'value', enteredValue);
  }

  resolveEnteredValue() {
    this.setEnteredValue(undefined);
  }

  private getEnteredValue() {
    if (this.enteredValueMap.has(this.propertyName)) {
      return this.enteredValueMap.get(this.propertyName);
    }
    return undefined;
  }

  private setEnteredValue(value) {
    if (value === undefined) {
      this.enteredValueMap.delete(this.propertyName);
    } else {
      this.enteredValueMap.set(this.propertyName, value);
    }
  }
}

interface PropertyInputModel {
  readonly model?: any;
  readonly numSelections: number;
  readonly inspectedProperties: ReadonlyArray<InspectedProperty<any>>;
  // TODO: use a union type here for better type safety?
  readonly icon?: string;
  readonly description?: string;
  readonly subDescription?: string;
}
