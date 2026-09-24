import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import { environment } from 'environments/environment';
import { version } from 'environments/version';

type Severity = 'error' | 'warning' | 'info';

/** Starts error reporting. Must be called once at startup, before the app renders. */
export function startBugsnag() {
  Bugsnag.start({
    apiKey: 'd662c2c8a7e13ac94f67e81e26bf3a4e',
    appVersion: version,
    releaseStage: environment.production ? 'production' : 'development',
    enabledReleaseStages: ['production'],
    autoTrackSessions: false,
    plugins: [new BugsnagPluginReact()],
  });
}

/**
 * Reports to Bugsnag once it has been started, and does nothing before then
 * (e.g. in unit tests).
 */
export const bugsnagClient = {
  notify(error: Error | string, opts: { severity?: Severity } = {}) {
    if (!Bugsnag.isStarted()) {
      return;
    }
    Bugsnag.notify(error, event => {
      if (opts.severity) {
        event.severity = opts.severity;
      }
    });
  },

  leaveBreadcrumb(message: string, metadata?: { [key: string]: any }) {
    if (Bugsnag.isStarted()) {
      Bugsnag.leaveBreadcrumb(message, metadata);
    }
  },
};
