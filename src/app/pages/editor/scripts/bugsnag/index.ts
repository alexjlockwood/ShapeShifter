import BugsnagErrorHandler from 'bugsnag-angular';
import bugsnag from 'bugsnag-js';
import { environment } from 'environments/environment';
import { version } from 'environments/version';

export const bugsnagClient = bugsnag({
  apiKey: 'd662c2c8a7e13ac94f67e81e26bf3a4e',
  appVersion: version,
  releaseStage: environment.production ? 'production' : 'development',
  notifyReleaseStages: ['production'],
});

export function errorHandlerFactory() {
  return new BugsnagErrorHandler(bugsnagClient);
}
