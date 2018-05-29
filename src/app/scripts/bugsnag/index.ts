import BugsnagErrorHandler from 'bugsnag-angular';
import bugsnag from 'bugsnag-js';

const bugsnagClient = bugsnag('d662c2c8a7e13ac94f67e81e26bf3a4e');

export function errorHandlerFactory() {
  return new BugsnagErrorHandler(bugsnagClient);
}
