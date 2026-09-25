import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import './styles.scss';

import Bugsnag from '@bugsnag/js';
import { App } from 'app/modules/editor/components/root/App';
import { startBugsnag } from 'app/modules/editor/scripts/bugsnag';
import { createEditorServices } from 'app/modules/editor/services/createEditorServices';
import { Duration } from 'app/modules/editor/services/snackbar.service';
import { createEditorStore } from 'app/modules/editor/store';
import { getThemeType } from 'app/modules/editor/store/theme/selectors';
import { environment } from 'environments/environment';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

startBugsnag();
const ErrorBoundary = Bugsnag.getPlugin('react').createErrorBoundary(React);

// Created once, outside of React, since the services subscribe to the store for the lifetime
// of the app.
const store = createEditorStore({ logActions: !environment.production });
const services = createEditorServices(store);

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
});

if (!environment.production) {
  // Handy for debugging from the console.
  Object.assign(window, { shapeshifter: { store, services } });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App store={store} services={services} ErrorBoundary={ErrorBoundary} />
  </StrictMode>,
);
