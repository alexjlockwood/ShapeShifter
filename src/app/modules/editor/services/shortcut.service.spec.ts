import { createEditorStore, type State, type Store } from 'app/modules/editor/store';

import { createEditorServices, type EditorServices } from './createEditorServices';

describe('ShortcutService', () => {
  let store: Store<State>;
  let services: EditorServices;

  beforeEach(() => {
    store = createEditorStore();
    services = createEditorServices(store);
    services.shortcutService.init();
  });

  afterEach(() => {
    services.dispose();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  function pressWithModifier(target: EventTarget, key: string) {
    // Both modifiers, so that the shortcut fires whichever one the platform uses.
    const event = new KeyboardEvent('keydown', {
      keyCode: key.charCodeAt(0),
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('undoes and groups layers outside of text fields', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const group = vi.spyOn(services.layerTimelineService, 'groupOrUngroupSelectedLayers');
    expect(pressWithModifier(document.body, 'Z').defaultPrevented).toBe(true);
    expect(dispatch).toHaveBeenCalled();
    expect(pressWithModifier(document.body, 'G').defaultPrevented).toBe(true);
    expect(group).toHaveBeenCalled();
  });

  it('leaves undo and grouping to a focused text field', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    const group = vi.spyOn(services.layerTimelineService, 'groupOrUngroupSelectedLayers');
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    expect(pressWithModifier(input, 'Z').defaultPrevented).toBe(false);
    expect(pressWithModifier(input, 'G').defaultPrevented).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(group).not.toHaveBeenCalled();
  });
});
