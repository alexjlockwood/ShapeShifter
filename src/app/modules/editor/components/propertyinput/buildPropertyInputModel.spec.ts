import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation } from 'app/modules/editor/model/timeline';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { SetSelectedLayers } from 'app/modules/editor/store/layers/actions';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { SelectAnimation, SetSelectedBlocks } from 'app/modules/editor/store/timeline/actions';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';

import { buildPropertyInputModel, type PropertyInputModel } from './buildPropertyInputModel';

describe('buildPropertyInputModel', () => {
  it("shows nothing if the selected layer or block doesn't exist", () => {
    const store = createEditorStore();
    const { layerTimelineService } = createEditorServices(store);
    const deps = { store, layerTimelineService, enteredValueMap: new Map() };

    const noSelections: PropertyInputModel = {
      numSelections: 0,
      inspectedProperties: [],
      availablePropertyNames: [],
    };

    store.dispatch(new SetSelectedLayers(new Set(['missing'])));
    expect(buildPropertyInputModel(deps, getPropertyInputState(store.getState()))).toEqual(
      noSelections,
    );
    store.dispatch(new SetSelectedLayers(new Set()));
    store.dispatch(new SetSelectedBlocks(new Set(['missing'])));
    expect(buildPropertyInputModel(deps, getPropertyInputState(store.getState()))).toEqual(
      noSelections,
    );
  });

  describe('editing names', () => {
    let store: Store<State>;
    let services: EditorServices;
    let path: PathLayer;

    beforeEach(() => {
      store = createEditorStore();
      services = createEditorServices(store);
      const newPath = (name: string) =>
        new PathLayer({ name, children: [], pathData: new Path('M 0 0 L 10 10') });
      path = newPath('path');
      const vl = new VectorLayer({ name: 'vector', children: [path, newPath('other')] });
      store.dispatch(new ResetWorkspace(vl, new Animation({ name: 'anim' })));
    });

    afterEach(() => {
      services.dispose();
    });

    function enterName(name: string) {
      const deps = {
        store,
        layerTimelineService: services.layerTimelineService,
        enteredValueMap: new Map(),
      };
      const { inspectedProperties } = buildPropertyInputModel(
        deps,
        getPropertyInputState(store.getState()),
      );
      const nameProperty = inspectedProperties.find(p => p.propertyName === 'name');
      nameProperty!.editableValue = name;
    }

    function getPathName() {
      return getVectorLayer(store.getState()).findLayerById(path.id)!.name;
    }

    it.each(['Path', 'path ', 'path!'])(
      "keeps a layer's name when %j sanitizes to it",
      (name: string) => {
        store.dispatch(new SetSelectedLayers(new Set([path.id])));
        enterName(name);
        expect(getPathName()).toBe('path');
      },
    );

    it("makes a layer's new name unique", () => {
      store.dispatch(new SetSelectedLayers(new Set([path.id])));
      enterName('Other');
      expect(getPathName()).toBe('other_1');
    });

    it.each(['', '  ', '!!!'])("keeps a layer's name when %j sanitizes to nothing", name => {
      store.dispatch(new SetSelectedLayers(new Set([path.id])));
      enterName(name);
      expect(getPathName()).toBe('path');
    });

    it.each(['', '!!!'])("keeps the animation's name when %j sanitizes to nothing", name => {
      store.dispatch(new SelectAnimation(true));
      enterName(name);
      expect(getAnimation(store.getState()).name).toBe('anim');
    });
  });
});
