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
      "id": "1",
      "name": "demo",
      "type": "vector",
      "children": [
        {
          "id": "3",
          "name": "group",
          "type": "group",
          "pivotX": "12",
          "pivotY": "12",
          "scaleX": "1",
          "scaleY": "1",
          "children": [
            {
              "id": "4",
              "name": "orange",
              "type": "path",
              "pathData": "M 1 1 h 6 v 2 h -6 v -2 Z",
              "fillColor": "#ffa500"
            },
            {
              "id": "5",
              "name": "green",
              "type": "path",
              "pathData": "M 8 1 h 6 v 2 h -6 v -2 Z",
              "fillColor": "#00ff00"
            },
            {
              "id": "6",
              "name": "blue",
              "type": "path",
              "pathData": "M 16 1 h 6 v 2 h -6 v -2 Z",
              "fillColor": "#0000ff"
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
