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
      return 'pathlayer';
    } else if (this.layer.isClipPathLayer()) {
      return 'clippathlayer';
    } else if (this.layer.isGroupLayer()) {
      return 'grouplayer';
    } else {
      return 'vectorlayer';
    }
  }

  trackLayerFn(index: number, layer: Layer) {
    return layer.id; // TODO: will this be OK for renamed layers?
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
