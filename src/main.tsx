import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import './styles.scss';

import Bugsnag from '@bugsnag/js';
import { loadCanvasEditor } from 'app/modules/editor/components/canvas/loadCanvasEditor';
import { App } from 'app/modules/editor/components/root/App';
import { startAnalytics } from 'app/modules/editor/scripts/analytics';
import {
  bugsnagClient,
  isServiceWorkerDeployError,
  startBugsnag,
} from 'app/modules/editor/scripts/bugsnag';
import { getStoredItem, removeStoredItem, setStoredItem } from 'app/modules/editor/scripts/storage';
import { createEditorServices } from 'app/modules/editor/services/createEditorServices';
import { Duration } from 'app/modules/editor/services/snackbar.service';
import { createEditorStore } from 'app/modules/editor/store';
import { getThemeType } from 'app/modules/editor/store/theme/selectors';
import { environment } from 'environments/environment';
import { getBuildFeatures, resolveFeatures, withoutCanvasEditorReset } from 'environments/features';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

const features = resolveFeatures({
  search: window.location.search,
  storage: { getItem: getStoredItem, setItem: setStoredItem, removeItem: removeStoredItem },
  buildDefault: getBuildFeatures(import.meta.env),
});
const search = withoutCanvasEditorReset(window.location.search);
if (search !== window.location.search) {
  const { pathname, hash } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
}
if (features.canvasEditor) {
  // Starts the download now rather than once the canvas renders. The canvas reports a failure.
  void loadCanvasEditor().catch(() => {});
}

startBugsnag(features);
const bugsnagReactPlugin = Bugsnag.getPlugin('react');
if (!bugsnagReactPlugin) {
  throw new Error("Bugsnag's React plugin wasn't added when Bugsnag started");
}
const ErrorBoundary = bugsnagReactPlugin.createErrorBoundary(React);
startAnalytics();

// Created once, outside of React, since the services subscribe to the store for the lifetime
// of the app.
const store = createEditorStore({ logActions: !environment.production });
const services = createEditorServices(store, { features });

// Apply the theme before the first render, so that the page doesn't flash the wrong colors.
document.body.classList.toggle(
  'ss-dark-theme',
  getThemeType(store.getState()).themeType === 'dark',
);

registerSW({
  onOfflineReady() {
    services.snackBarService.show('Ready to work offline', 'Dismiss', Duration.Long);
  },
  // New versions activate right away (see vite.config.ts), and the next page load gets them.
  // Reloading an open page could lose the user's work.
  onNeedReload() {},
  // E.g. in private windows, or when the app is opened from a file. It still works, just not
  // offline. A worker script that fails to run means the deploy is broken, so report those.
  onRegisterError(error) {
    if (isServiceWorkerDeployError(error)) {
      bugsnagClient.notify(error, { severity: 'info' });
    } else {
      bugsnagClient.leaveBreadcrumb('Service worker registration failed', { error: String(error) });
    }
  },
});

if (!environment.production) {
  // Handy for debugging from the console.
  Object.assign(window, { shapeshifter: { store, services } });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('The page is missing its root element');
}
createRoot(rootElement).render(
  <StrictMode>
    <App store={store} services={services} ErrorBoundary={ErrorBoundary} />
  </StrictMode>,
);
