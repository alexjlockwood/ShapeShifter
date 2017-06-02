import { AvdSerializer } from '../scripts/export';
import { SvgLoader, VectorDrawableLoader } from '../scripts/import';
import { LayerUtil, VectorLayer } from '../scripts/layers';
import { Animation } from '../scripts/timeline';
import { State, Store } from '../store';
import { getActiveVectorLayer } from '../store/layers/selectors';
import { getActiveAnimation } from '../store/timeline/selectors';
import { Injectable } from '@angular/core';
import * as $ from 'jquery';

/**
 * A simple service that exports vectors and animations.
 */
@Injectable()
export class FileExportService {
  private vectorLayer: VectorLayer;
  private animation: Animation;

  constructor(readonly store: Store<State>) {
    this.store.select(getActiveVectorLayer).subscribe(vl => this.vectorLayer = vl);
    this.store.select(getActiveAnimation).subscribe(anim => this.animation = anim);
  }

  // TODO: should we or should we not export currently hidden layers?
  exportVectorDrawable() {
    const vl = this.vectorLayer;
    const vd = AvdSerializer.toVectorDrawableXmlString(vl);
    const fileName = `vd_${vl.name}.xml`;
    downloadFile(vd, fileName);
  }

  exportAnimatedVectorDrawable() {
    const vl = this.vectorLayer;
    const anim = this.animation;
    const avd = AvdSerializer.toAnimatedVectorDrawableXmlString(vl, anim);
    const fileName = `avd_${anim.name}.xml`;
    downloadFile(avd, fileName);
  }
}

function downloadFile(content: string | Blob, fileName: string) {
  const anchor = $('<a>').hide().appendTo(document.body);
  let blob: Blob;
  if (content instanceof Blob) {
    blob = content;
  } else {
    blob = new Blob([content], { type: 'octet/stream' });
  }
  const url = window.URL.createObjectURL(blob);
  anchor.attr({ href: url, download: fileName });
  anchor.get(0).click();
  window.URL.revokeObjectURL(url);
}
