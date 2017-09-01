import 'rxjs/add/operator/combineLatest';
import 'rxjs/add/operator/map';

import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActionMode } from 'app/model/actionmode';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { FractionProperty, NameProperty, Option } from 'app/model/properties';
import { Animation, PathAnimationBlock } from 'app/model/timeline';
import { ColorUtil, ModelUtil } from 'app/scripts/common';
import {
  ActionModeService,
  AnimatorService,
  LayerTimelineService,
  ShortcutService,
  ThemeService,
} from 'app/services';
import { State, Store } from 'app/store';
import { getPropertyInputState } from 'app/store/common/selectors';
import { ThemeType } from 'app/store/theme/reducer';
import { SetAnimation } from 'app/store/timeline/actions';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

import { InspectedProperty } from './InspectedProperty';

declare const ga: Function;

// TODO: when you enter a 'start time' larger than 'end time', transform 'end time' correctly
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

  themeState$: Observable<{ prevThemeType: ThemeType; currThemeType: ThemeType }>;

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
    private readonly animatorService: AnimatorService,
    private readonly layerTimelineService: LayerTimelineService,
    public readonly themeService: ThemeService,
  ) {}

  ngOnInit() {
    let prevThemeType: ThemeType;
    let currThemeType = this.themeService.getThemeType().themeType;
    this.propertyInputModel$ = this.store
      .select(getPropertyInputState)
      .map(
        ({ animation, isAnimationSelected, selectedBlockIds, vectorLayer, selectedLayerIds }) => {
          prevThemeType = currThemeType = this.themeService.getThemeType().themeType;
          if (selectedLayerIds.size) {
            return this.buildInspectedLayerProperties(vectorLayer, selectedLayerIds, animation);
          } else if (selectedBlockIds.size) {
            return this.buildInspectedBlockProperties(vectorLayer, animation, selectedBlockIds);
          } else if (isAnimationSelected) {
            return this.buildInspectedAnimationProperties(animation);
          } else {
            return {
              numSelections: 0,
              inspectedProperties: [],
              availablePropertyNames: [],
            } as PropertyInputModel;
          }
        },
      );
    this.themeState$ = Observable.combineLatest(
      this.propertyInputModel$,
      this.themeService.asObservable(),
    ).map(([unused, { themeType }]) => {
      prevThemeType = currThemeType;
      currThemeType = this.themeService.getThemeType().themeType;
      return { prevThemeType, currThemeType };
    });
  }

  shouldShowStartActionModeButton(pim: PropertyInputModel) {
    return pim.numSelections === 1 && pim.model instanceof PathAnimationBlock;
  }

  shouldDisableStartActionModeButton(pim: PropertyInputModel) {
    if (!this.shouldShowStartActionModeButton(pim)) {
      return false;
    }
    const { fromValue, toValue } = pim.model as PathAnimationBlock;
    return !fromValue || !fromValue.getPathString() || !toValue || !toValue.getPathString();
  }

  onAutoFixPathsClick(pim: PropertyInputModel) {
    this.actionModeService.autoFix();
  }

  onStartActionModeClick() {
    ga('send', 'event', 'Action mode', 'Started');
    this.actionModeService.setActionMode(ActionMode.Selection);
  }

  shouldShowAnimateLayerButton(pim: PropertyInputModel) {
    return (
      pim.availablePropertyNames.length > 0 &&
      pim.numSelections === 1 &&
      (pim.model instanceof VectorLayer ||
        pim.model instanceof GroupLayer ||
        pim.model instanceof ClipPathLayer ||
        pim.model instanceof PathLayer)
    );
  }

  onAnimateLayerClick(layer: Layer, propertyName: string) {
    const clonedValue = layer.inspectableProperties
      .get(propertyName)
      .cloneValue(layer[propertyName]);
    const currentTime = this.animatorService.getCurrentTime();
    this.layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName,
        fromValue: clonedValue,
        toValue: clonedValue,
        currentTime,
      },
    ]);
  }

  shouldShowInvalidPathAnimationBlockMsg(pim: PropertyInputModel) {
    return (
      pim.numSelections === 1 &&
      pim.model instanceof PathAnimationBlock &&
      !pim.model.isAnimatable()
    );
  }

  isPathBlockFromValueEmpty(block: PathAnimationBlock) {
    return !block.fromValue || !block.fromValue.getPathString();
  }

  isPathBlockToValueEmpty(block: PathAnimationBlock) {
    return !block.toValue || !block.toValue.getPathString();
  }

  onValueEditorKeyDown(event: KeyboardEvent, ip: InspectedProperty<any>) {
    switch (event.keyCode) {
      // Up/down arrow buttons.
      case 38:
      case 40:
        ip.resolveEnteredValue();
        const $target = $(event.target) as JQuery<HTMLInputElement>;
        const numberValue = Number($target.val());
        if (isNaN(numberValue)) {
          break;
        }
        let delta = event.keyCode === 38 ? 1 : -1;

        if (ip.property instanceof FractionProperty) {
          delta *= 0.1;
        }

        if (event.shiftKey) {
          // TODO: make this more obvious somehow
          delta *= 10;
        } else if (ShortcutService.getOsDependentModifierKey(event)) {
          // TODO: make this more obvious somehow
          delta /= 10;
        }

        ip.property.setEditableValue(ip, 'value', Number((numberValue + delta).toFixed(6)));
        setTimeout(() => $target.get(0).select(), 0);
        return false;
    }
    return undefined;
  }

  private buildInspectedLayerProperties(
    vl: VectorLayer,
    selectedLayerIds: Set<string>,
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
    const enteredValueMap = this.enteredValueMap;
    const layer = selectedLayers[0];
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
            const clonedLayer = layer.clone();
            clonedLayer[propertyName] = value;
            this.layerTimelineService.updateLayer(clonedLayer);
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

  private buildInspectedBlockProperties(
    vl: VectorLayer,
    animation: Animation,
    selectedBlockIds: Set<string>,
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
    const enteredValueMap = this.enteredValueMap;
    const block = selectedBlocks[0];
    const icon = 'animationblock';
    const description = block.propertyName;
    const blockLayer = vl.findLayerById(block.layerId);
    const subDescription = `for '${blockLayer.name}'`;
    const inspectedProperties: InspectedProperty<any>[] = [];
    block.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(
        new InspectedProperty<any>(block, property, propertyName, enteredValueMap, value => {
          // TODO: avoid dispatching the action if the properties are equal
          const clonedBlock = block.clone();
          clonedBlock[propertyName] = value;
          this.layerTimelineService.updateBlocks([clonedBlock]);
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

  private buildInspectedAnimationProperties(animation: Animation) {
    const store = this.store;
    const enteredValueMap = this.enteredValueMap;
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
            const clonedAnimation = animation.clone();
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

interface PropertyInputModel {
  readonly model?: any;
  readonly numSelections: number;
  readonly inspectedProperties: ReadonlyArray<InspectedProperty<any>>;
  // TODO: use a union type here for better type safety?
  readonly icon?: string;
  readonly description?: string;
  readonly subDescription?: string;
  readonly availablePropertyNames: ReadonlyArray<string>;
}
