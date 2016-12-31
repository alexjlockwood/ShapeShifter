import { Component, OnInit } from '@angular/core';
import { VectorLayer, PathLayer } from './scripts/models';
import * as SvgLoader from './scripts/svgloader';
import { SvgPathData } from './scripts/svgpathdata';


const debugMode = true;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private startVectorLayer: VectorLayer;
  private previewVectorLayer: VectorLayer;
  private endVectorLayer: VectorLayer;
  private shouldLabelPoints = false;

  ngOnInit() {
    if (debugMode) {
      this.initDebugMode();
    }
  }

  private initDebugMode() {
    this.onStartSvgTextLoaded(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <g transform="translate(12,12)">
          <g transform="scale(0.75,0.75)">
            <g transform="translate(-12,-12)">
              <path d="M 0 0 L 4 4 C 11 12 17 12 24 12" stroke="#000" stroke-width="1" />
            </g>
          </g>
        </g>
      </svg>`);
    this.onEndSvgTextLoaded(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <g transform="translate(12,12)">
          <g transform="scale(0.75,0.75)">
            <g transform="translate(-12,-12)">
              <path d="M 0 0 L 12 12 C 16 16 20 20 24 24" stroke="#000" stroke-width="1" />
            </g>
          </g>
        </g>
      </svg>`);
  }

  private animatePreviewVectorLayer(fraction: number): VectorLayer {
    const animateLayer = layer => {
      if (layer.children) {
        layer.children.forEach(l => animateLayer(l));
        return;
      }
      if (layer instanceof PathLayer) {
        const sl = this.startVectorLayer.findLayerById(layer.id);
        const el = this.endVectorLayer.findLayerById(layer.id);
        if (sl && el && sl instanceof PathLayer && el instanceof PathLayer) {
          if (SvgPathData.arePathsMorphable(sl.pathData, el.pathData)) {
            const newPathData = SvgPathData.interpolatePaths(sl.pathData, el.pathData, fraction);
            if (newPathData) {
              layer.pathData = newPathData;
            }
          }
        }
      }
    };
    animateLayer(this.previewVectorLayer);
    return Object.create(this.previewVectorLayer);
  }

  onStartSvgTextLoaded(svgText: string) {
    this.startVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  onEndSvgTextLoaded(svgText: string) {
    this.endVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  onAnimationFractionChanged(fraction: number) {
    this.previewVectorLayer = this.animatePreviewVectorLayer(fraction);
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    this.shouldLabelPoints = shouldLabelPoints;
  }

  maybeDisplayPreview() {
    if (this.shouldDisplayCanvases()) {
      this.previewVectorLayer = this.startVectorLayer.clone();
    }
  }

  shouldDisplayCanvases() {
    return this.startVectorLayer && this.endVectorLayer;
  }
}
