import { Component, OnInit, OnDestroy } from '@angular/core';
import { Layer, VectorLayer, GroupLayer, PathLayer } from './scripts/models';
import * as SvgLoader from './scripts/svgloader';
import { SvgPathData } from './scripts/svgpathdata';
import { Point } from './scripts/mathutil';
import { DrawCommand, MoveCommand, LineCommand, ClosePathCommand } from './scripts/svgcommands';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { StateService, VectorLayerType } from './state.service';


const debugMode = true;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly startVectorLayerType = VectorLayerType.Start;
  private readonly previewVectorLayerType = VectorLayerType.Preview;
  private readonly endVectorLayerType = VectorLayerType.End;

  private selectedCommands: DrawCommand[] = [];
  private isPathMorphable = true;
  private shouldLabelPoints = true;
  private areVectorLayersCompatible = false;
  private subscription: Subscription = null;

  constructor(private stateService: StateService) { }

  ngOnInit() {
    if (debugMode) {
      this.initDebugMode();
    }
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onStartSvgTextLoaded(svgText: string) {
    this.startVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.previewVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  onEndSvgTextLoaded(svgText: string) {
    this.endVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  private maybeDisplayPreview() {
    if (this.startVectorLayer && this.endVectorLayer) {
      this.areVectorLayersCompatible = this.startVectorLayer.isStructurallyIdenticalWith(this.endVectorLayer);
      if (!this.areVectorLayersCompatible) {
        console.warn('vector layer structures are not structurally identical');
      }
    }
    if (this.shouldDisplayCanvases()) {
      this.isPathMorphable = this.startVectorLayer.isMorphableWith(this.endVectorLayer);
      this.subscription = this.stateService.subscribeToVectorLayer(VectorLayerType.End, vectorLayer => {
        this.isPathMorphable = this.startVectorLayer.isMorphableWith(this.endVectorLayer);
      });
    }
  }

  shouldDisplayCanvases() {
    return this.startVectorLayer && this.endVectorLayer && this.areVectorLayersCompatible;
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    this.shouldLabelPoints = shouldLabelPoints;
  }

  onAnimationFractionChanged(fraction: number) {
    this.previewVectorLayer = this.animatePreviewVectorLayer(fraction);
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
          if (layer.pathData.isMorphableWith(sl.pathData, el.pathData)) {
            layer.pathData.interpolate(sl.pathData, el.pathData, fraction);
          }
        }
      }
    };
    animateLayer(this.previewVectorLayer);
    return this.previewVectorLayer;
  }

  onSelectedCommandsChanged(selectedCommands: DrawCommand[]) {
    if (!this.isPathMorphable) {
      return;
    }
    // TODO(alockwood): avoid change detection if selected commands haven't changed
    this.selectedCommands = selectedCommands;
  }

  private get startVectorLayer() {
    return this.stateService.getVectorLayer(this.startVectorLayerType);
  }

  private set startVectorLayer(vectorLayer: VectorLayer) {
    this.stateService.setVectorLayer(this.startVectorLayerType, vectorLayer);
  }

  private get previewVectorLayer() {
    return this.stateService.getVectorLayer(this.previewVectorLayerType);
  }

  private set previewVectorLayer(vectorLayer: VectorLayer) {
    this.stateService.setVectorLayer(this.previewVectorLayerType, vectorLayer);
  }

  private get endVectorLayer() {
    return this.stateService.getVectorLayer(this.endVectorLayerType);
  }

  private set endVectorLayer(vectorLayer: VectorLayer) {
    this.stateService.setVectorLayer(this.endVectorLayerType, vectorLayer);
  }

  onDividerDrag(event) {
    console.log(event);
  }

  private initDebugMode() {
    // this.onStartSvgTextLoaded(`
    //   <svg xmlns="http://www.w3.org/2000/svg"
    //     width="24px"
    //     height="24px"
    //     viewBox="0 0 24 24">
    //     <path d="M 5 11 L 11 11 L 11 5 L 13 5 L 13 11 L 19 11 L 19 13 L 13 13 L 13 19 L 11 19 L 11 13 L 5 13 Z"
    //       fill="#000" />
    //   </svg>`);
    // this.onEndSvgTextLoaded(`
    //   <svg xmlns="http://www.w3.org/2000/svg"
    //     width="24px"
    //     height="24px"
    //     viewBox="0 0 24 24">
    //     <path d="M 19 11 L 5 11 L 5 13 L 19 13 Z"
    //       fill="#000" />
    //   </svg>`);
    this.onStartSvgTextLoaded(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <g transform="translate(12,12)">
          <g transform="scale(0.75,0.75)">
            <g transform="translate(-12,-12)">
              <path d="M 0 0 L 12 12 C 13 13 14 14 15 15 C 16 16 17 17 18 18 C 19 19 20 20 21 21 C 22 22 23 23 24 24 L 24 24" stroke="#000" stroke-width="1" />
            </g>
          </g>
        </g>
      </svg>`);
    this.onEndSvgTextLoaded(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <g transform="translate(12,12)">
          <g transform="scale(0.75,0.75)">
            <g transform="translate(-12,-12)">
              <path d="M 0 0 L 4 4 C 11 12 17 12 24 12 L 24 24" stroke="#000" stroke-width="1" />
            </g>
          </g>
        </g>
      </svg>`);
    // const groupLayerStart = this.startVectorLayer.children[0] as GroupLayer;
    // groupLayerStart.pivotX = 12;
    // groupLayerStart.pivotY = 12;
    // groupLayerStart.rotation = 180;
    // const groupLayerPreview = this.previewVectorLayer.children[0] as GroupLayer;
    // groupLayerPreview.pivotX = 12;
    // groupLayerPreview.pivotY = 12;
    // groupLayerPreview.rotation = 180;
    // const groupLayerEnd = this.endVectorLayer.children[0] as GroupLayer;
    // groupLayerEnd.pivotX = 12;
    // groupLayerEnd.pivotY = 12;
    // groupLayerEnd.rotation = 180;
  }
}
