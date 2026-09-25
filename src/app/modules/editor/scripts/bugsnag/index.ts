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
    onError: event => isReportable(window.location, event.errors[0]?.errorMessage),
  });
}

/**
 * Returns false for errors that don't come from Shape Shifter's own site, since forks and other
 * apps that bundle a copy of it use the same API key. Also returns false for errors from
 * cross-origin scripts, which browsers strip of any details.
 */
export function isReportable(
  { protocol, hostname }: { readonly protocol: string; readonly hostname: string },
  errorMessage: string | undefined,
) {
  return (
    protocol === 'https:' &&
    /(^|\.)shapeshifter\.design$/.test(hostname) &&
    errorMessage !== 'Script error.'
  );
}

/**
 * Reports to Bugsnag once it has been started, and does nothing before then
 * (e.g. in unit tests).
 */
export const bugsnagClient = {
  notify(
    error: Error | string,
    opts: { severity?: Severity; metadata?: { [section: string]: object } } = {},
  ) {
    if (!Bugsnag.isStarted()) {
      return;
    }
    Bugsnag.notify(error, event => {
      if (opts.severity) {
        event.severity = opts.severity;
      }
      for (const [section, values] of Object.entries(opts.metadata || {})) {
        event.addMetadata(section, values);
      }
    });
  },

  leaveBreadcrumb(message: string, metadata?: { [key: string]: any }) {
    if (Bugsnag.isStarted()) {
      Bugsnag.leaveBreadcrumb(message, metadata);
    }
  },
};
