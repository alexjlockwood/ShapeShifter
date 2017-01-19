import {
  Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy
} from '@angular/core';
import { Layer, VectorLayer, GroupLayer, PathLayer } from './scripts/model';
import { SvgLoader } from './scripts/svg';
import { Point } from './scripts/common';
import { EditorType } from './scripts/model';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { LayerStateService } from './services/layerstate.service';
import { DividerDragEvent } from './splitter/splitter.directive';
import * as $ from 'jquery';

const debugMode = true;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  public readonly startVectorLayerType = EditorType.Start;
  public readonly previewVectorLayerType = EditorType.Preview;
  public readonly endVectorLayerType = EditorType.End;
  shouldLabelPoints = true;
  isMorphable = false;

  private isStructurallyIdentical = false;
  private subscriptions: Subscription[] = [];

  @ViewChild('appContainer') appContainerRef: ElementRef;
  @ViewChild('canvasContainer') canvasContainerRef: ElementRef;
  @ViewChild('inspectorContainer') inspectorContainerRef: ElementRef;
  private appContainer: JQuery;
  private canvasContainer: JQuery;
  private inspectorContainer: JQuery;
  private lastDividerDragEvent: DividerDragEvent;

  constructor(private layerStateService: LayerStateService) { }

  ngOnInit() {
    if (debugMode) {
      this.initDebugMode();
    }
  }

  ngAfterViewInit() {
    this.appContainer = $(this.appContainerRef.nativeElement);
    this.canvasContainer = $(this.canvasContainerRef.nativeElement);
    this.inspectorContainer = $(this.inspectorContainerRef.nativeElement);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  onStartSvgTextLoaded(svgText: string) {
    this.startVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.previewVectorLayer = this.startVectorLayer.clone();
    this.maybeDisplayPreview();
  }

  onEndSvgTextLoaded(svgText: string) {
    this.endVectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
    this.maybeDisplayPreview();
  }

  private maybeDisplayPreview() {
    if (this.startVectorLayer && this.endVectorLayer) {
      this.isStructurallyIdentical =
        this.startVectorLayer.isStructurallyIdenticalWith(this.endVectorLayer);
      if (!this.isStructurallyIdentical) {
        console.warn('vector layer structures are not structurally identical');
      }
    }
    if (this.shouldDisplayCanvases()) {
      this.checkAreLayersMorphable();
      this.subscriptions.push(
        this.layerStateService.addListener(EditorType.Start, vl => {
          this.checkAreLayersMorphable();
        }));
      this.subscriptions.push(
        this.layerStateService.addListener(EditorType.End, vl => {
          this.checkAreLayersMorphable();
        }));
    }
  }

  private checkAreLayersMorphable() {
    const wasMorphable = this.isMorphable;
    this.isMorphable = this.startVectorLayer.isMorphableWith(this.endVectorLayer);
    if (this.isMorphable && !wasMorphable) {
      // Recreate the preview canvas layer.
      this.previewVectorLayer = this.startVectorLayer.clone();
    }
  }

  shouldDisplayCanvases() {
    return this.startVectorLayer && this.endVectorLayer && this.isStructurallyIdentical;
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    this.shouldLabelPoints = shouldLabelPoints;
  }

  private get startVectorLayer() {
    return this.layerStateService.getData(this.startVectorLayerType);
  }

  private set startVectorLayer(vectorLayer: VectorLayer) {
    this.layerStateService.setData(this.startVectorLayerType, vectorLayer);
  }

  private get previewVectorLayer() {
    return this.layerStateService.getData(this.previewVectorLayerType);
  }

  private set previewVectorLayer(vectorLayer: VectorLayer) {
    this.layerStateService.setData(this.previewVectorLayerType, vectorLayer);
  }

  private get endVectorLayer() {
    return this.layerStateService.getData(this.endVectorLayerType);
  }

  private set endVectorLayer(vectorLayer: VectorLayer) {
    this.layerStateService.setData(this.endVectorLayerType, vectorLayer);
  }

  onDividerDrag(event: DividerDragEvent) {
    // console.log(event);
    if (event.move) {
      const appContainerRect = this.appContainer.get(0).getBoundingClientRect();
      const appContainerWidth = appContainerRect.width;
      const appContainerHeight = appContainerRect.height;
      const canvasContainerRect = this.canvasContainer.get(0).getBoundingClientRect();
      const canvasContainerWidth = canvasContainerRect.width;
      const canvasContainerHeight = canvasContainerRect.height;
      const inspectorContainerRect = this.inspectorContainer.get(0).getBoundingClientRect();
      const inspectorContainerWidth = inspectorContainerRect.width;
      const inspectorContainerHeight = inspectorContainerRect.height;
      const heightDiff = event.move.y - event.start.y;
      this.canvasContainer.height(event.move.y);
      this.inspectorContainer.height(appContainerHeight - event.move.y);
    }
    this.lastDividerDragEvent = event;
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
              <path d="M 0 0 L 12 12 C 13 13 14 14 15 15 C 16 16 17 17 18 18
                       C 19 19 20 20 21 21 C 22 22 23 23 24 24 L 24 24"
                       stroke="#000" stroke-width="1" />
            </g>
          </g>
        </g>
        <g transform="translate(0,9)">
          <g transform="scale(1.25,1.25)">
            <path d="M 2,6 C 2,3.79 3.79,2 6,2 C 8.21,2 10,3.79 10,6 C 10,8.21 8.21,10 6,10 C 3.79,10 2,8.21 2,6"
                     fill="#DB4437"/>
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
        <g transform="translate(0,12)">
          <g transform="scale(1,1)">
            <path d="M 2,6 C 2,3.79 3.79,2 6,2 C 8.21,2 10,3.79 10,6 C 10,8.21 8.21,10 6,10 C 3.79,10 2,8.21 2,6"
                     fill="#DB4437" />
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
