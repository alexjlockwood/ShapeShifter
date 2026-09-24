import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import type { State, Store } from 'app/modules/editor/store';
import { createContext, type ReactNode, use, useMemo } from 'react';
import { Provider } from 'react-redux';

interface EditorContextValue {
  readonly store: Store<State>;
  readonly services: EditorServices;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

/** Provides the store and services to the app's components. */
export function EditorProvider({
  store,
  services,
  children,
}: EditorContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ store, services }), [store, services]);
  return (
    <Provider store={store.redux}>
      <EditorContext value={value}>{children}</EditorContext>
    </Provider>
  );
}

function useEditorContext() {
  const value = use(EditorContext);
  if (!value) {
    throw new Error('Editor hooks must be used inside of an EditorProvider');
  }
  return value;
}

export function useEditorStore() {
  return useEditorContext().store;
}

export function useServices() {
  return useEditorContext().services;
}
