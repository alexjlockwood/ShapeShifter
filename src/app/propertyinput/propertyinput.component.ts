import { Component, OnInit } from '@angular/core';
import { Property, IdProperty } from '../scripts/properties';
import { StateService } from '../services';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-propertyinput',
  templateUrl: './propertyinput.component.html',
  styleUrls: ['./propertyinput.component.scss'],
  // TODO: make this OnPush change detection
})
export class PropertyInputComponent implements OnInit {

  vlObservable: Observable<VectorLayer[]>;

  selectionInfo;

  constructor(private readonly stateService: StateService) { }

  ngOnInit() {
    this.vlObservable = this.stateService.getVectorLayersObservable();
    this.vlObservable.subscribe(() => {
      this.rebuildLayersSelection();
    });
  }

  onValueEditorKeyDown(event: MouseEvent, ip: InspectedProperty) {
    console.info('onValueEditorKeyDown', ip);
  }

  androidToCssColor(color: string) {
    console.info('androidToCssColor', color);
  }

  rebuildLayersSelection() {
    this.selectionInfo = {
      type: 'layers',
      description: '',
      inspectedProperties: [],
    };

    // edit a single layer
    const layers = this.stateService.getImportedVectorLayers();
    if (!layers.length) {
      return;
    }
    const layer = layers[0].findLayer('bottom_inner_path');
    this.selectionInfo.icon = 'vector';
    Object.defineProperty(this.selectionInfo, 'description', {
      get: () => layer.id
    });
    (layer.inspectableProperties).forEach((property, propertyName) => {
      // const self = this;
      this.selectionInfo.inspectedProperties.push(new InspectedProperty({
        object: layer,
        propertyName,
        property,
        get value() {
          return layer[propertyName];
          // if (!self.studioState_.animationRenderer || layer === self.studioState_.artwork) {
          //   return layer[propertyName];
          // }

          // let renderedLayer = self.studioState_.animationRenderer
          //   .renderedArtwork.findLayerById(layer.id);
          // return renderedLayer ? renderedLayer[propertyName] : undefined;
        },
        set value(value) {
          // if (property instanceof IdProperty) {
          // self.studioState_.updateLayerId(layer, value);
          // } else {
          layer[propertyName] = value;
          // self.studioState_.artworkChanged();
          // }
        },
        transformEditedValue: (property instanceof IdProperty)
          ? enteredValue => enteredValue // this.studioState_.getUniqueLayerId(IdProperty.sanitize(enteredValue), layer)
          : undefined,
        get editable() {
          return true;
          // return self.studioState_.animationRenderer
          //   ? !self.studioState_.animationRenderer.getLayerPropertyState(layer.id, propertyName).activeBlock
          //   : true;
        }
      }));
    });
  }
}

interface SelectionInfo {
  type: string;
  icon?: string;
  description: string;
  subDescription?: string;
  inspectedProperties: InspectedProperty[];
}

class InspectedProperty {
  private delegate: any;
  private object: any;
  private propertyName: string;
  private property: Property<any>;
  private enteredValue: any;

  constructor(delegate) {
    this.delegate = delegate;
    this.object = delegate.object;
    this.propertyName = delegate.propertyName;
    this.property = delegate.property;
  }

  get value() {
    return ('value' in this.delegate)
      ? this.delegate.value
      : this.object[this.propertyName];
  }

  set value(value) {
    ('value' in this.delegate)
      ? (this.delegate.value = value)
      : (this.object[this.propertyName] = value);
    if (this.delegate.onChange) {
      this.delegate.onChange();
    }
  }

  get typeName() {
    return this.property.constructor.name;
  }

  get editable() {
    return 'editable' in this.delegate ? this.delegate.editable : true;
  }

  get displayValue() {
    return this.property.displayValueForValue(this.value);
  }

  get editableValue() {
    return (this.enteredValue !== undefined)
      ? this.enteredValue
      : this.property.getEditableValue(this, 'value');
  }

  set editableValue(enteredValue) {
    this.enteredValue = enteredValue;
    if (this.delegate.transformEditedValue) {
      enteredValue = this.delegate.transformEditedValue(enteredValue);
    }
    this.property.trySetEditedValue(this, 'value', enteredValue);
  }

  resolveEnteredValue() {
    this.enteredValue = undefined;
  }
}
