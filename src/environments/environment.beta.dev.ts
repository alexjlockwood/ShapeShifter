import { firebaseOptions } from './firebase';

export const environment = {
  production: false,
  beta: true,
  analyticsTrackingId: 'UA-92075411-2',
  firebaseOptions,
  isEmailPasswordLoginEnabled: false,
  isGoogleLoginEnabled: true,
  isFacebookLoginEnabled: false,
  isTwitterLoginEnabled: false,
};
