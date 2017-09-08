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
import { PaperService } from 'app/services';
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
    private readonly paperService: PaperService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$canvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
  }

  ngAfterViewInit() {
    Paper.initialize(this.$canvas.get(0), this.paperService);

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
          "scaleX": "1.25",
          "scaleY": "1.25",
          "rotation": "90",
          "children": [
            {
              "id": "46",
              "name": "ellipse",
              "type": "path",
              "pathData": "M 12 10 C 9.8 10 8 10.9 8 12 C 8 13.105 9.8 14 12 14 C 14.2 14 16 13.1 16 12 C 16 10.895 14.2 10 12 10 Z",
              "strokeColor": "#000",
              "strokeWidth": "0.1"
            },
            {
              "id": "460",
              "name": "rect",
              "type": "path",
              "pathData": "M 4 4 h 2 v 4 h -2 v -4",
              "strokeColor": "#000",
              "strokeWidth": "0.1"
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
