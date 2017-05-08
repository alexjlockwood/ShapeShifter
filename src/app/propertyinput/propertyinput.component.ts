import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Property, PathProperty } from '../scripts/properties';
import { StateService } from '../services';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { ColorUtil } from '../scripts/common';
import { newPath } from '../scripts/paths';
import { Store } from '@ngrx/store'
import { State, getVectorLayerState } from '../scripts/store/reducers';

@Component({
  selector: 'app-propertyinput',
  templateUrl: './propertyinput.component.html',
  styleUrls: ['./propertyinput.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyInputComponent implements OnInit {

  propertyInputModel$: Observable<PropertyInputData>;

  constructor(private readonly store: Store<State>) { }

  ngOnInit() {
    this.propertyInputModel$ =
      this.store.select(getVectorLayerState)
        .map(state => this.buildPropertyInputData(state.vectorLayers));
  }

  private buildPropertyInputData(vls: ReadonlyArray<VectorLayer>) {
    let selectionInfo: PropertyInputData = {
      inspectedProperties: [],
    };

    // edit a single layer
    if (!vls.length) {
      return selectionInfo;
    }
    selectionInfo = {
      icon: 'vectorlayer',
      inspectedProperties: [],
    };
    const layer = vls[0].findLayer('bottom_inner_path');
    layer.inspectableProperties.forEach((property, propertyName) => {
      selectionInfo.inspectedProperties.push(
        new InspectedProperty<any>(
          layer,
          propertyName,
          property,
        ));
    });
    return selectionInfo
    // object: layer,
    // propertyName,
    // property,
    // get value() {
    // return layer[propertyName];
    // if (!self.studioState_.animationRenderer || layer === self.studioState_.artwork) {
    //   return layer[propertyName];
    // }
    // let renderedLayer = self.studioState_.animationRenderer
    //   .renderedArtwork.findLayerById(layer.name);
    // return renderedLayer ? renderedLayer[propertyName] : undefined;
    // },
    // set value(value) {
    // if (property instanceof NameProperty) {
    // self.studioState_.updateLayerId(layer, value);
    // } else {
    // layer[propertyName] = value;
    // self.studioState_.artworkChanged();
    // }
    // },
    // }));
    // });
  }

  onValueEditorKeyDown(event: MouseEvent, ip: InspectedProperty<any>) {
    // console.info('onValueEditorKeyDown', ip);
  }

  androidToCssColor(color: string) {
    return ColorUtil.androidToCssColor(color);
  }
}

interface PropertyInputData {
  type?: string;
  icon?: string;
  description?: string;
  subDescription?: string;
  inspectedProperties: InspectedProperty<any>[];
}

class InspectedProperty<T> {
  private enteredValue: string;

  constructor(
    private readonly model: any,
    public readonly propertyName: string,
    private readonly property: Property<T>,
  ) { }

  get value(): T {
    return this.model[this.propertyName];
    // return ('value' in this.delegate)
    //   ? this.delegate.value
    //   : this.model[this.propertyName];
  }

  set value(value: T) {
    this.model[this.propertyName] = value;
    // ('value' in this.delegate)
    //   ? (this.delegate.value = value)
    //   : (this.model[this.propertyName] = value);
    // if (this.delegate.onChange) {
    //   this.delegate.onChange();
    // }
  }

  get typeName() {
    return this.property.constructor.name;
  }

  get editable() {
    return true;
  }

  get displayValue() {
    return this.property.displayValueForValue(this.value);
  }

  get editableValue() {
    return this.enteredValue === undefined ? this.displayValue : this.enteredValue;
  }

  // TODO: if NameProperty, replace with sanitized unique ID
  // TODO: should call property.setEditableValue() here instead for ids/paths/strings/etc?
  set editableValue(enteredValue: string) {
    this.enteredValue = enteredValue;
    if (this.property instanceof PathProperty) {
      try {
        // TODO: can this type assertion be avoided?
        this.value = (newPath(enteredValue) as any) as T;
      } catch (e) {
        // The path string is invalid.
      }
    } else {
      // TODO: can this type assertion be avoided?
      this.value = (enteredValue as any) as T;
    }
  }

  resolveEnteredValue() {
    this.enteredValue = undefined;
  }
}
