import { CanvasViewportService } from 'app/modules/editor/services/canvasviewport.service';
import { createEditorStore } from 'app/modules/editor/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasCamera } from './CanvasCamera';
import { CanvasNavigation } from './CanvasNavigation';

const PANEL = { w: 400, h: 300 };

describe('CanvasNavigation', () => {
  let root: HTMLElement;
  let artboard: HTMLElement;
  let service: CanvasViewportService;
  let navigation: CanvasNavigation;

  const camera = () =>
    CanvasCamera.create({
      panel: PANEL,
      viewport: { w: 24, h: 24 },
      pixelRatio: 1,
      view: service.getView(),
    });
  const artboardRect = () => camera().getArtboardRect();

  beforeEach(() => {
    root = document.createElement('div');
    Object.assign(root.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${PANEL.w}px`,
      height: `${PANEL.h}px`,
    });
    artboard = document.createElement('div');
    root.appendChild(artboard);
    document.body.appendChild(root);
    service = new CanvasViewportService(createEditorStore({ logActions: false }));
    navigation = new CanvasNavigation(root, service, camera);
    navigation.init();
  });

  afterEach(() => {
    navigation.dispose();
    service.dispose();
    root.remove();
  });

  function wheel(init: WheelEventInit) {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    root.dispatchEvent(event);
    return event;
  }

  function pointer(type: string, target: HTMLElement, init: PointerEventInit) {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('zooms and pans with two fingers, and cancels what the first one started', () => {
    navigation.dispose();
    const onPinchStart = vi.fn<() => void>();
    navigation = new CanvasNavigation(root, service, camera, onPinchStart);
    navigation.init();
    const pressed: number[] = [];
    artboard.addEventListener('pointerdown', event => pressed.push(event.pointerId));
    const touch = (type: string, pointerId: number, clientX: number, clientY: number) =>
      pointer(type, artboard, {
        pointerId,
        pointerType: 'touch',
        isPrimary: pointerId === 1,
        clientX,
        clientY,
      });
    const before = camera();
    touch('pointerdown', 1, 150, 150);
    touch('pointerdown', 2, 250, 150);
    // The second finger's press doesn't reach the artboard, and the first one's gesture stops.
    expect(pressed).toEqual([1]);
    expect(onPinchStart).toHaveBeenCalledTimes(1);
    // Spreading the fingers to twice as far apart zooms in twice as much around their middle.
    const middle = before.panelToViewport({ x: 200, y: 150 });
    touch('pointermove', 1, 100, 150);
    touch('pointermove', 2, 300, 150);
    expect(camera().scale).toBeCloseTo(before.scale * 2, 6);
    expect(camera().viewportToPanel(middle).x).toBeCloseTo(200, 6);
    // Moving them together pans.
    touch('pointermove', 1, 110, 160);
    touch('pointermove', 2, 310, 160);
    expect(camera().viewportToPanel(middle).x).toBeCloseTo(210, 6);
    expect(camera().viewportToPanel(middle).y).toBeCloseTo(160, 6);
    touch('pointerup', 2, 310, 160);
    touch('pointerup', 1, 110, 160);
  });

  it('pans by the wheel, in pixels or in lines', () => {
    const { x, y } = artboardRect();
    expect(wheel({ deltaY: 10 }).defaultPrevented).toBe(true);
    expect(artboardRect()).toMatchObject({ x, y: y - 10 });
    // Firefox's mouse wheels can scroll by lines.
    wheel({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(artboardRect()).toMatchObject({ x, y: y - 10 - 48 });
  });

  it('pans sideways when scrolling with Shift held', () => {
    const { x, y } = artboardRect();
    wheel({ deltaY: 10, shiftKey: true });
    expect(artboardRect()).toMatchObject({ x: x - 10, y });
  });

  it('zooms around the pointer when scrolling with Ctrl held, a little at a time', () => {
    const fit = camera();
    const pointerAt = { clientX: 100, clientY: 80 };
    const under = fit.panelToViewport({ x: 100, y: 80 });
    wheel({ deltaY: -20, ctrlKey: true, ...pointerAt });
    expect(camera().scale).toBeCloseTo(fit.scale * Math.exp(0.2), 9);
    const zoomed = camera().viewportToPanel(under);
    expect(zoomed.x).toBeCloseTo(100, 0);
    expect(zoomed.y).toBeCloseTo(80, 0);

    // A mouse wheel's notch doesn't zoom by more than about 1.65.
    const before = camera().scale;
    wheel({ deltaY: -500, ctrlKey: true, ...pointerAt });
    expect(camera().scale).toBeCloseTo(before * Math.exp(0.5), 9);
  });

  it('pans by dragging with the middle button, without autoscrolling', () => {
    const { x, y } = artboardRect();
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 1 });
    root.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
    pointer('pointerdown', root, { button: 1, buttons: 4, clientX: 100, clientY: 100 });
    expect(root.classList.contains('is-panning')).toBe(true);
    pointer('pointermove', root, { buttons: 4, clientX: 130, clientY: 110 });
    expect(artboardRect()).toMatchObject({ x: x + 30, y: y + 10 });
    pointer('pointerup', root, { button: 1, clientX: 130, clientY: 110 });
    expect(root.classList.contains('is-panning')).toBe(false);
  });

  it('pans by dragging with the space bar held, instead of starting a gesture', () => {
    const artboardPresses = vi.fn<() => void>();
    artboard.addEventListener('pointerdown', artboardPresses);
    const artboardClicks = vi.fn<() => void>();
    artboard.addEventListener('click', artboardClicks);
    const { x, y } = artboardRect();

    service.pressSpace({ repeat: false });
    pointer('pointerdown', artboard, { button: 0, buttons: 1, clientX: 50, clientY: 50 });
    expect(artboardPresses).not.toHaveBeenCalled();
    pointer('pointermove', root, { buttons: 1, clientX: 60, clientY: 45 });
    pointer('pointerup', root, { button: 0, clientX: 60, clientY: 45 });
    expect(artboardRect()).toMatchObject({ x: x + 10, y: y - 5 });
    // The click that ends it doesn't reach the workspace, where it would clear the selection.
    artboard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(artboardClicks).not.toHaveBeenCalled();
    // Only that click.
    pointer('pointerdown', artboard, { button: 0, buttons: 1 });
    artboard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(artboardClicks).toHaveBeenCalledTimes(1);
    // And releasing the space bar doesn't play.
    expect(service.releaseSpace()).toBe(false);
  });

  it("counts scrolling while the space bar is held as panning, so releasing it doesn't play", () => {
    service.pressSpace({ repeat: false });
    wheel({ deltaY: 10 });
    expect(service.releaseSpace()).toBe(false);
  });

  it('ends a pan on Escape, on blur, and when its release went elsewhere', () => {
    const startPan = () =>
      pointer('pointerdown', root, { button: 1, buttons: 4, clientX: 100, clientY: 100 });
    const expectNoPan = () => {
      const before = artboardRect();
      pointer('pointermove', root, { buttons: 4, clientX: 150, clientY: 150 });
      expect(artboardRect()).toEqual(before);
    };

    startPan();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expectNoPan();

    startPan();
    window.dispatchEvent(new Event('blur'));
    expectNoPan();

    // E.g. to a context menu. The mouse moves with no buttons down.
    startPan();
    pointer('pointermove', root, { buttons: 0, clientX: 120, clientY: 120 });
    expectNoPan();
  });
});
