import * as _ from 'lodash';
import * as $ from 'jquery';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Property, PathProperty, NameProperty, FractionProperty, Inspectable, Option } from '../scripts/properties';
import { StateService } from '../services';
import { VectorLayer, LayerUtil, Layer } from '../scripts/layers';
import { Animation, AnimationBlock } from '../scripts/animations';
import { Observable } from 'rxjs/Observable';
import { ColorUtil } from '../scripts/common';
import { newPath } from '../scripts/paths';
import { Store } from '@ngrx/store'
import {
  State,
  getAnimations,
  getVectorLayers,
  getSelectedLayerIds,
  getSelectedAnimationIds,
  getSelectedBlockIds,
  ReplaceVectorLayer,
  ReplaceBlocks,
  ReplaceAnimations,
} from '../store';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-propertyinput',
  templateUrl: './propertyinput.component.html',
  styleUrls: ['./propertyinput.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyInputComponent implements OnInit {

  propertyInputModel$: Observable<PropertyInputModel>;

  constructor(private readonly store: Store<State>) { }

  ngOnInit() {
    this.propertyInputModel$ =
      Observable.combineLatest(
        this.store.select(getAnimations),
        this.store.select(getVectorLayers),
        this.store.select(getSelectedLayerIds),
        this.store.select(getSelectedAnimationIds),
        this.store.select(getSelectedBlockIds),
      ).map(([animations, vls, selectedLayerIds, selectedAnimationIds, selectedBlockIds]) => {
        if (selectedLayerIds.size) {
          return this.buildInspectedLayerProperties(vls, selectedLayerIds);
        } else if (selectedBlockIds.size) {
          return this.buildInspectedBlockProperties(vls, animations, selectedBlockIds);
        } else if (selectedAnimationIds.size) {
          return this.buildInspectedAnimationProperties(animations, selectedAnimationIds);
        } else {
          return { numSelections: 0, inspectedProperties: [] };
        }
      });
  }

  valueEditorKeyDown(event: KeyboardEvent, ip: InspectedProperty<Inspectable, any>) {
    switch (event.keyCode) {
      // Up/down arrow buttons.
      case 38:
      case 40:
        ip.resolveEnteredValue();
        const $target = $(event.target);
        let numberValue = Number($target.val());
        if (!isNaN(numberValue)) {
          let delta = (event.keyCode === 38) ? 1 : -1;

          if (ip.property instanceof FractionProperty) {
            delta *= .1;
          }

          if (event.shiftKey) {
            delta *= 10;
          } else if (event.altKey) {
            delta /= 10;
          }

          numberValue += delta;
          ip.property.setEditableValue(ip, 'value', Number(numberValue.toFixed(6)));
          setTimeout(() => ($target.get(0) as HTMLInputElement).select(), 0);
          return false;
        }
        break;
    }
    return undefined;
  }

  private buildInspectedLayerProperties(
    vls: ReadonlyArray<VectorLayer>,
    selectedLayerIds: Set<string>,
  ) {
    const numSelections = selectedLayerIds.size;
    const selectedLayers =
      Array.from(selectedLayerIds).map(id => LayerUtil.findLayer(vls, id));
    if (numSelections > 1) {
      // TODO: implement batch editting
      return {
        numSelections: 0,
        inspectedProperties: [],
      } as PropertyInputModel;
    }
    // Edit a single layer.
    const store = this.store;
    const layer = selectedLayers[0];
    const icon = layer.getType();
    const description = layer.name;
    const inspectedProperties: InspectedProperty<Layer, any>[] = [];
    layer.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(new InspectedProperty<Layer, any>({
        property,
        propertyName,
        get value() {
          // TODO: return the 'rendered' value if an animation is ongoing? (see AIA)
          // TODO: return the 'rendered' value if an animation is ongoing? (see AIA)
          // TODO: return the 'rendered' value if an animation is ongoing? (see AIA)
          // TODO: return the 'rendered' value if an animation is ongoing? (see AIA)
          // return property.getEditableValue(layer, propertyName);
          return layer[propertyName];
        },
        set value(value) {
          // if (property instanceof NameProperty) {
          //   self.studioState_.updateLayerId(layer, value);
          // } else {
          //   layer[propertyName] = value;
          //   self.studioState_.artworkChanged();
          // }
          // TODO: need to somehow save the 'entered value' after data store updates?
          // TODO: need to somehow save the 'entered value' after data store updates?
          // TODO: need to somehow save the 'entered value' after data store updates?
          // TODO: need to somehow save the 'entered value' after data store updates?
          // TODO: should avoid recreating the layer too when possible
          // TODO: should avoid recreating the layer too when possible
          // TODO: should avoid recreating the layer too when possible
          // TODO: should avoid recreating the layer too when possible
          const vl = LayerUtil.findVectorLayer(vls, layer.id);
          const clonedLayer = layer.clone();
          // TODO: confirm this the right way to set a new value on the cloned Layer?
          // TODO: confirm this the right way to set a new value on the cloned Layer?
          // TODO: confirm this the right way to set a new value on the cloned Layer?
          // TODO: confirm this the right way to set a new value on the cloned Layer?
          // clonedLayer.inspectableProperties.get(propertyName)
          //   .setEditableValue(clonedLayer, propertyName, value);
          clonedLayer[propertyName] = value;
          const clonedVl = LayerUtil.replaceLayerInTree(vl, clonedLayer);
          store.dispatch(new ReplaceVectorLayer(clonedVl));
        },
        transformEditedValueFn: (property instanceof NameProperty)
          // TODO: replace entered value with a unique value if the name already exists
          // TODO: replace entered value with a unique value if the name already exists
          // TODO: replace entered value with a unique value if the name already exists
          // TODO: replace entered value with a unique value if the name already exists
          ? (enteredValue: string) => NameProperty.sanitize(enteredValue)
          : undefined,
        get editable() {
          // TODO: copy AIA conditions to determine whether this should be editable
          return true;
        }
      }));
    });
    return {
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
      // TODO: implement batch editting
      return {
        numSelections: 0,
        inspectedProperties: [],
      } as PropertyInputModel;
    }
    const store = this.store;
    const block = selectedBlocks[0];
    const icon = 'animationblock';
    const description = block.propertyName;
    const blockLayer = LayerUtil.findLayer(vectorLayers, block.layerId);
    const subDescription = `for '${blockLayer.name}'`;
    const inspectedProperties: InspectedProperty<AnimationBlock<any>, any>[] = [];
    block.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(new InspectedProperty<AnimationBlock<any>, any>({
        property,
        propertyName,
        get value() {
          return block[propertyName];
        },
        set value(value: any) {
          const clonedBlock = block.clone();
          // TODO: confirm this the right way to set a new value on the cloned block?
          // TODO: confirm this the right way to set a new value on the cloned block?
          // TODO: confirm this the right way to set a new value on the cloned block?
          // TODO: confirm this the right way to set a new value on the cloned block?
          // clonedBlock.inspectableProperties.get(propertyName)
          //   .setEditableValue(clonedBlock, propertyName, value);
          clonedBlock[propertyName] = value;
          store.dispatch(new ReplaceBlocks([clonedBlock]));
        },
        get editable() {
          return true;
        }
      }));
    });
    return {
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
      // TODO: implement batch editting
      return {
        numSelections: 0,
        inspectedProperties: [],
      } as PropertyInputModel;
    }
    const store = this.store;
    const animation = selectedAnimations[0];
    const icon = 'animation';
    const description = animation.name;
    const inspectedProperties: InspectedProperty<Animation, any>[] = [];
    animation.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(new InspectedProperty<Animation, any>({
        property,
        propertyName,
        get value() {
          return animation[propertyName];
        },
        set value(value) {
          // if (property instanceof NameProperty) {
          //   self.studioState_.updateLayerId(layer, value);
          // } else {
          //   layer[propertyName] = value;
          //   self.studioState_.artworkChanged();
          // }
          // TODO: need to make sure name updates don't conflict with other animations
          // TODO: need to make sure name updates don't conflict with other animations
          // TODO: need to make sure name updates don't conflict with other animations
          // TODO: need to make sure name updates don't conflict with other animations
          // TODO: should avoid recreating the Animation too when possible
          // TODO: should avoid recreating the Animation too when possible
          // TODO: should avoid recreating the Animation too when possible
          // TODO: should avoid recreating the Animation too when possible
          const clonedAnimation = animation.clone();
          // TODO: confirm this the right way to set a new value on the cloned Animation?
          // TODO: confirm this the right way to set a new value on the cloned Animation?
          // TODO: confirm this the right way to set a new value on the cloned Animation?
          // TODO: confirm this the right way to set a new value on the cloned Animation?
          // clonedAnimation.inspectableProperties.get(propertyName)
          //  .setEditableValue(clonedAnimation, propertyName, value);
          clonedAnimation[propertyName] = value;
          store.dispatch(new ReplaceAnimations([clonedAnimation]));
        },
        transformEditedValueFn: (property instanceof NameProperty)
          // TODO: replace entered value with a unique value if the name already exists
          // TODO: replace entered value with a unique value if the name already exists
          // TODO: replace entered value with a unique value if the name already exists
          // TODO: replace entered value with a unique value if the name already exists
          ? (enteredValue: string) => NameProperty.sanitize(enteredValue)
          : undefined,
        get editable() {
          return true;
        }
      }));
    });
    return {
      numSelections,
      inspectedProperties,
      icon,
      description,
    } as PropertyInputModel;
  }

  // Called from the HTML template.
  androidToCssColor(color: string) {
    return ColorUtil.androidToCssColor(color);
  }

  trackInspectedPropertyFn(index: number, ip: InspectedProperty<Inspectable, any>) {
    return ip.propertyName;
  }

  trackEnumOptionFn(index: number, option: Option) {
    return option.value;
  }
}

// TODO: use this for batch editing
function getSharedPropertyNames(items: ReadonlyArray<Inspectable>) {
  if (!items || !items.length) {
    return [];
  }
  let shared: ReadonlyArray<string>;
  items.forEach(item => {
    const names = Array.from(item.inspectableProperties.keys());
    if (!shared) {
      shared = names;
    } else {
      shared = shared.filter(n => names.includes(n));
    }
  });
  return shared;
}

/**
 * Stores information about an inspected property. M is the type of model
 * object being inspected (i.e. layer, animation, animation block), and
 * V is the property value type (number, string, path).
 */
class InspectedProperty<M extends Inspectable, V> {
  public readonly property: Property<V>;
  public readonly propertyName: string;
  private enteredValue: V;

  constructor(public readonly delegate: Delegate<M, V>) {
    this.property = delegate.property;
    this.propertyName = delegate.propertyName;
  }

  get value() {
    return this.delegate.value;
  }

  set value(value: V) {
    this.delegate.value = value;
  }

  get typeName() {
    return this.property.constructor.name;
  }

  get editable() {
    return this.delegate.editable;
  }

  get displayValue() {
    return this.property.displayValueForValue(this.value);
  }

  get editableValue() {
    return (this.enteredValue !== undefined)
      ? this.enteredValue
      : this.property.getEditableValue(this, 'value');
  }

  set editableValue(enteredValue: V) {
    this.enteredValue = enteredValue;
    if (this.delegate.transformEditedValueFn) {
      enteredValue = this.delegate.transformEditedValueFn(enteredValue);
    }
    this.property.setEditableValue(this, 'value', enteredValue);

  }

  // TODO: need to trigger change detection somehow here or else value won't get reset!!
  // TODO: need to trigger change detection somehow here or else value won't get reset!!
  // TODO: need to trigger change detection somehow here or else value won't get reset!!
  // TODO: need to trigger change detection somehow here or else value won't get reset!!
  // TODO: need to trigger change detection somehow here or else value won't get reset!!
  resolveEnteredValue() {
    this.enteredValue = undefined;
  }
}

interface Delegate<M extends Inspectable, V> {
  readonly property: Property<V>;
  readonly propertyName: string;
  value: V;
  readonly transformEditedValueFn?: (editedValue: V) => V;
  readonly editable: boolean;
}

interface PropertyInputModel {
  readonly numSelections: number;
  readonly inspectedProperties: ReadonlyArray<InspectedProperty<Inspectable, any>>;
  // TODO: use a union type here for better type safety?
  readonly icon?: string;
  readonly description?: string;
  readonly subDescription?: string;
}
