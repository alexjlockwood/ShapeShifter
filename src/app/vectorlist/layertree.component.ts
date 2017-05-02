import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Layer } from '../scripts/layers';
import { StateService } from '../services';

@Component({
  selector: 'app-layertree',
  templateUrl: './layertree.component.html',
  styleUrls: ['./layertree.component.scss']
})
export class LayerTreeComponent implements OnInit {
  @Output() onLayerClick = new EventEmitter<{ event: MouseEvent, layer: Layer }>();
  @Output() onLayerDoubleClick = new EventEmitter<{ event: MouseEvent, layer: Layer }>();
  @Output() onLayerMouseDown = new EventEmitter<{ event: MouseEvent, layer: Layer }>();

  @Input() layer: Layer;
  children: ReadonlyArray<Layer>;

  constructor(private readonly stateService: StateService) { }

  ngOnInit() {
    this.children = this.layer.children;
  }

  getLayerTypeName() {
    if (this.layer.isPathLayer()) {
      return 'path';
    } else if (this.layer.isClipPathLayer()) {
      return 'clippath';
    } else if (this.layer.isGroupLayer()) {
      return 'group';
    } else {
      return 'vector';
    }
  }

  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }

  layerClick(event: MouseEvent, layer: Layer) {
    this.onLayerClick.emit({ event, layer });
  }

  layerDoubleClick(event: MouseEvent, layer: Layer) {
    this.onLayerDoubleClick.emit({ event, layer });
  }

  layerMouseDown(event: MouseEvent, layer: Layer) {
    this.onLayerMouseDown.emit({ event, layer });
  }
}
