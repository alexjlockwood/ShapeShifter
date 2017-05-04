import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-propertyinput',
  templateUrl: './propertyinput.component.html',
  styleUrls: ['./propertyinput.component.scss']
})
export class PropertyInputComponent implements OnInit {

  selectionInfo: SelectionInfo = {
    icon: 'vector',
    description: 'vector',
    inspectedProperties: [{
      editable: true,
      typeName: 'ColorProperty',
      displayValue: '',
      editableValue: '',
      propertyName: 'color',
      resolveEnteredValue: () => { },
    } as InspectedProperty<string>],
  };

  constructor() { }

  ngOnInit() {
  }

  onValueEditorKeyDown(event: MouseEvent, ip: InspectedProperty<string | number>) {
    console.info('onValueEditorKeyDown', ip);
  }

  androidToCssColor(color: string) {
    console.info('androidToCssColor', color);
  }
}

interface SelectionInfo {
  icon: string;
  description: string;
  subDescription?: string;
  inspectedProperties: InspectedProperty<string | number>[];
}

interface InspectedProperty<T> {
  propertyName: string;
  value: T;
  displayValue: string;
  editableValue: T;
  typeName: string;
  editable: boolean;
  resolveEnteredValue();
}
