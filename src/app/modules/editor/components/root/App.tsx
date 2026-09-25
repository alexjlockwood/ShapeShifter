import Button from '@mui/material/Button';
import { StyledEngineProvider } from '@mui/material/styles';
import type { BugsnagErrorBoundary } from '@bugsnag/plugin-react';
import { DialogHost } from 'app/modules/editor/components/dialogs';
import { SnackbarHost } from 'app/modules/editor/components/snackbar/SnackbarHost';
import { EditorProvider, useServices } from 'app/modules/editor/context/EditorContext';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import type { State, Store } from 'app/modules/editor/store';

import { EditorThemeProvider } from './EditorThemeProvider';
import { Root } from './Root';

interface AppProps {
  readonly store: Store<State>;
  readonly services: EditorServices;
  readonly ErrorBoundary: BugsnagErrorBoundary;
}

export function App({ store, services, ErrorBoundary }: AppProps) {
  return (
    // Inject MUI's styles first so that the app's own styles can override them.
    <StyledEngineProvider injectFirst>
      <EditorProvider store={store} services={services}>
        <EditorThemeProvider>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Root />
          </ErrorBoundary>
          <DialogHost />
          <SnackbarHost />
        </EditorThemeProvider>
      </EditorProvider>
    </StyledEngineProvider>
  );
}

// The store outlives the component tree, so the project can still be saved after a crash.
function ErrorFallback() {
  const { fileExportService } = useServices();
  return (
    <div className="app-error fx-column fx-align-center">
      <p>Sorry, something went wrong.</p>
      <div className="fx-row">
        <Button color="secondary" onClick={() => fileExportService.exportJSON()}>
          Save project
        </Button>
        <Button color="secondary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
