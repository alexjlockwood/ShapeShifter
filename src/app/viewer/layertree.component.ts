import * as _ from 'lodash';
import { Component, OnInit, Input } from '@angular/core';
import { Layer } from '../scripts/layers';

// TODO: determine if we want to show group layers
const SHOULD_HIDE_GROUP_LAYERS = true;

@Component({
  selector: 'app-layertree',
  templateUrl: './layertree.component.html',
  styleUrls: ['./layertree.component.scss']
})
export class LayerTreeComponent implements OnInit {
  @Input() layer: Layer;
  children: ReadonlyArray<Layer>;

  ngOnInit() {
    if (this.layer.isVectorLayer() && SHOULD_HIDE_GROUP_LAYERS) {
      this.children =
        (function recurseFn(layer: Layer) {
          if (layer.isPathLayer() || layer.isClipPathLayer()) {
            return [layer];
          }
          return _.flatten(_.map(layer.children, child => recurseFn(child)));
        })(this.layer);
    } else {
      this.children = this.layer.children;
    }
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

  trackLayer(index: number, layer: Layer) {
    return layer.id;
  }
}
