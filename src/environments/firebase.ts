interface FirebaseOptions {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly databaseURL: string;
  readonly projectId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
}

export const firebaseOptions: FirebaseOptions = {
  apiKey: 'AIzaSyBlqUMIThpxAuF2mUrQHt5Kkt7Qt87CRxc',
  authDomain: 'shape-shifter-design.firebaseapp.com',
  databaseURL: 'https://shape-shifter-design.firebaseio.com',
  projectId: 'shape-shifter-design',
  storageBucket: 'shape-shifter-design.appspot.com',
  messagingSenderId: '695925357713',
};
