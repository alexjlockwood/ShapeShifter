import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import { environment } from 'environments/environment';
import { isShapeShifterSite } from 'environments/site';
import { version } from 'environments/version';

type Severity = 'error' | 'warning' | 'info';

// Scripts that browser extensions and userscript managers inject into the page. Their errors
// aren't ours, but unlike cross-origin scripts, browsers don't strip their details.
const INJECTED_SCRIPT_PREFIXES = [
  'chrome-extension:',
  'moz-extension:',
  'safari-extension:',
  'safari-web-extension:',
  'webkit-masked-url:',
  'user-script:',
];

/** Starts error reporting. Must be called once at startup, before the app renders. */
export function startBugsnag() {
  Bugsnag.start({
    apiKey: 'd662c2c8a7e13ac94f67e81e26bf3a4e',
    appVersion: version,
    releaseStage: environment.production ? 'production' : 'development',
    enabledReleaseStages: ['production'],
    autoTrackSessions: false,
    plugins: [new BugsnagPluginReact()],
    onError: event => {
      const [error] = event.errors;
      return isReportable(window.location, error?.errorMessage, error?.stacktrace[0]?.file);
    },
  });
}

/**
 * Returns false for errors that don't come from Shape Shifter's own site, since forks and other
 * apps that bundle a copy of it use the same API key. Also returns false for errors from
 * cross-origin scripts, which browsers strip of any details, and for errors thrown by scripts
 * that extensions inject into the page.
 */
export function isReportable(
  location: { readonly protocol: string; readonly hostname: string },
  errorMessage: string | undefined,
  topFrameFile?: string,
) {
  return (
    isShapeShifterSite(location) &&
    errorMessage !== 'Script error.' &&
    !INJECTED_SCRIPT_PREFIXES.some(prefix => topFrameFile?.startsWith(prefix))
  );
}

/**
 * Returns whether a service worker registration error means the deployed worker is broken, rather
 * than that the browser doesn't allow one here (as in private windows, or when the app is opened
 * from a file) or that the network failed. Firefox reports failed precache downloads as "an error
 * during installation", so only a worker script that fails to run counts.
 */
export function isServiceWorkerDeployError(error: unknown) {
  return /script evaluation failed/i.test(String(error));
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
