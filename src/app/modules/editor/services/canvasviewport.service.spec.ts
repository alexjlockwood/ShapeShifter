import { VectorLayer } from 'app/modules/editor/model/layers';
import { createEditorStore } from 'app/modules/editor/store';
import { SetVectorLayer } from 'app/modules/editor/store/layers/actions';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { describe, expect, it } from 'vitest';

import { CanvasView, CanvasViewportService, FIT_VIEW } from './canvasviewport.service';

const ZOOMED: CanvasView = { type: 'manual', scale: 40, center: { x: 12, y: 12 } };

describe('CanvasViewportService', () => {
  function setUp() {
    const store = createEditorStore({ logActions: false });
    const service = new CanvasViewportService(store);
    const views: CanvasView[] = [];
    service.asObservable().subscribe(view => views.push(view));
    return { store, service, views };
  }

  function setViewportSize(store: ReturnType<typeof setUp>['store'], width: number) {
    const vl = getVectorLayer(store.getState()).clone();
    vl.width = width;
    store.dispatch(new SetVectorLayer(vl));
  }

  it('starts out fit to the canvas', () => {
    const { service, views } = setUp();
    expect(service.getView()).toEqual(FIT_VIEW);
    expect(views).toEqual([FIT_VIEW]);
  });

  it('only emits views that change', () => {
    const { service, views } = setUp();
    service.setView(ZOOMED);
    service.setView({ ...ZOOMED });
    service.fit();
    expect(views).toEqual([FIT_VIEW, ZOOMED, FIT_VIEW]);
  });

  it('fits a new project', () => {
    const { store, service } = setUp();
    service.setView(ZOOMED);
    store.dispatch(new ResetWorkspace(new VectorLayer()));
    expect(service.getView()).toEqual(FIT_VIEW);
  });

  it('fits when the viewport changes size, but not for other edits', () => {
    const { store, service } = setUp();
    service.setView(ZOOMED);
    const vl = getVectorLayer(store.getState()).clone();
    vl.alpha = 0.5;
    store.dispatch(new SetVectorLayer(vl));
    expect(service.getView()).toEqual(ZOOMED);

    setViewportSize(store, 48);
    expect(service.getView()).toEqual(FIT_VIEW);
  });

  it('stops following the store once disposed', () => {
    const { store, service } = setUp();
    service.setView(ZOOMED);
    service.dispose();
    setViewportSize(store, 48);
    expect(service.getView()).toEqual(ZOOMED);
  });
});
