import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
} from '@angular/core';
import { ActionSource } from 'app/model/actionmode';
import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { SvgLoader } from 'app/scripts/import';
import { DestroyableMixin } from 'app/scripts/mixins';
import { Paper } from 'app/scripts/paper';
import { LayerTimelineService } from 'app/services';
import { State, Store } from 'app/store';
import { SetVectorLayer } from 'app/store/layers/actions';
import { getVectorLayer } from 'app/store/layers/selectors';
import * as $ from 'jquery';
import * as paper from 'paper';
import { Point } from 'paper'; // TODO: figure out why this needs to be imported to prevent breaks?
import { Observable } from 'rxjs/Observable';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

type Context = CanvasRenderingContext2D;

@Directive({ selector: '[appCanvasPaper]' })
export class CanvasPaperDirective extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit, OnDestroy {
  @Input() actionSource: ActionSource;

  private readonly $canvas: JQuery<HTMLCanvasElement>;

  constructor(
    elementRef: ElementRef,
    private readonly layerTimelineService: LayerTimelineService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$canvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
  }

  ngAfterViewInit() {
    Paper.attach(this.$canvas.get(0), this.store);

    // TODO: remove this debug code
    const jsonObj = JSON.parse(`{
      "id": "43",
      "name": "playtopause",
      "type": "vector",
      "children": [
        {
          "id": "102",
          "name": "group",
          "type": "group",
          "pivotX": "12",
          "pivotY": "12",
          "scaleX": ".5",
          "scaleY": ".5",
          "children": [
            {
              "id": "102",
              "name": "group",
              "type": "group",
              "pivotX": "12",
              "pivotY": "12",
              "translateX": "4",
              "translateY": "0",
              "children": [
                {
                  "id": "45",
                  "name": "path",
                  "type": "path",
                  "pathData": "M6,12c0,-3.31371 2.6863,-6 6,-6c3.3137,0 6,2.6863 6,6c0,3.3137 -2.6863,6 -6,6c-3.31371,0 -6,-2.6863 -6,-6z",
                  "strokeColor": "#000000",
                  "fillColor": "#f00",
                  "strokeWidth": "1"
                },
                {
                  "id": "46",
                  "name": "path",
                  "type": "path",
                  "pathData": "M 1 1 h 3 v 4 h -3 v -4 z",
                  "strokeColor": "#000000",
                  "fillColor": "#f00"
                }
              ]
            }
          ]
        }
      ]
    }`);
    // TODO: remove this debug code
    this.store.dispatch(new SetVectorLayer(new VectorLayer(jsonObj)));
  }

  ngOnDestroy() {
    // TODO: support the ability to detach paper.js features? (i.e. Paper.detach(canvas))
  }

  // @Override
  onDimensionsChanged() {
    const { w, h } = this.getViewport();
    const scale = this.cssScale;
    this.$canvas.css({ width: w * scale, height: h * scale });
    Paper.updateProjectDimensions(w, h, w * scale, h * scale);
  }
}
