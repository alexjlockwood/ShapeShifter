import { firebaseOptions } from './firebase';

export const environment = {
  production: true,
  beta: false,
  analyticsTrackingId: 'UA-92075411-1',
  firebaseOptions,
  isEmailPasswordLoginEnabled: false,
  isGoogleLoginEnabled: true,
  isFacebookLoginEnabled: false,
  isTwitterLoginEnabled: false,
};
