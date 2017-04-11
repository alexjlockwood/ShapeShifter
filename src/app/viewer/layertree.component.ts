import { Component, OnInit, Input } from '@angular/core';
import { Layer } from '../scripts/layers';

@Component({
  selector: 'app-layertree',
  templateUrl: './layertree.component.html',
  styleUrls: ['./layertree.component.scss']
})
export class LayerTreeComponent implements OnInit {
  @Input() layer: Layer;

  constructor() { }

  ngOnInit() {
  }

  trackLayer(index: number, layer: Layer) {
    return layer.id;
  }
}
