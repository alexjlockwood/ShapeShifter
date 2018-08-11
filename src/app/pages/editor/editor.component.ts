import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Disabling view encapsulation here is necessary so that this component's styles
  // can globally alter the page's html/body tags.
  // tslint:disable-next-line:use-view-encapsulation
  encapsulation: ViewEncapsulation.None,
})
export class EditorComponent {}
