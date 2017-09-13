import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';
import { ActionSource } from 'app/model/actionmode';
import { VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { SvgLoader } from 'app/scripts/import';
import { DestroyableMixin } from 'app/scripts/mixins';
import { Paper } from 'app/scripts/paper';
import { PaperService } from 'app/services';
import { State, Store } from 'app/store';
import { SetVectorLayer } from 'app/store/layers/actions';
import { getVectorLayer } from 'app/store/layers/selectors';
import * as $ from 'jquery';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

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
          "name": "group1",
          "type": "group",
          "pivotX": "12",
          "pivotY": "12",
          "scaleX": "1.25",
          "scaleY": "1.25",
          "children": [
            {
              "id": "46",
              "name": "ellipse",
              "type": "path",
              "pathData": "M 12 10 C 9.8 10 8 10.9 8 12 C 8 13.105 9.8 14 12 14 C 14.2 14 16 13.1 16 12 C 16 10.895 14.2 10 12 10 Z",
              "strokeColor": "#000",
              "strokeWidth": "0.2"
            }
          ]
        },
        {
          "id": "6103",
          "name": "group2",
          "type": "group",
          "pivotX": "12",
          "pivotY": "12",
          "rotation": "90",
          "children": [
            {
              "id": "460",
              "name": "rect",
              "type": "path",
              "pathData": "M 4 4 h 2 v 4 h -2 v -4",
              "strokeColor": "#000",
              "strokeWidth": "0.2"
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
    Paper.updateDimensions(w, h, w * scale, h * scale);
  }
}
