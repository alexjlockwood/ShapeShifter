import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFirestore } from 'angularfire2/firestore';
import { SetUser } from 'app/core/auth/store/auth.actions';
import * as fromCore from 'app/core/store/core.reducer';
import { User } from 'app/shared/models/firestore';
import * as firebase from 'firebase/app';
import * as _ from 'lodash';
import { distinctUntilChanged, map } from 'rxjs/operators';

@Injectable()
export class AuthService {
  constructor(
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFirestore: AngularFirestore,
    private readonly store: Store<fromCore.State>,
  ) {
    // TODO: investigate if we should be reading this from the fire store instead?
    // TODO: should we set the user to the firestore here?
    // return this.angularFirestore.doc<User>(`users/${user.uid}`).valueChanges();
    this.angularFireAuth.authState.subscribe(user => {
      this.store.dispatch(new SetUser(fromFirebaseUser(user)));
    });
  }

  observeUser() {
    return this.store.pipe(select(state => state.auth.user), distinctUntilChanged(_.isEqual));
  }

  observeIsAuthenticated() {
    return this.observeUser().pipe(map(user => !!user));
  }

  signInWithGoogle() {
    return this.signInWithOAuth(new firebase.auth.GoogleAuthProvider());
  }

  private signInWithOAuth(provider: firebase.auth.AuthProvider) {
    return new Promise<void>((resolve, reject) => {
      this.angularFireAuth.auth.signInWithPopup(provider).then(
        credential => {
          // TODO: figure out what to do in the case that this write operation fails?
          this.updateUserData(credential.user);
          resolve();
        },
        error => {
          console.error(error);
          reject();
        },
      );
    });
  }

  private updateUserData(user: firebase.User) {
    const { uid: id, email, photoURL, displayName } = user;
    return this.angularFirestore
      .doc<User>(`users/${id}`)
      .set({ id, email, photoURL, displayName }, { merge: true });
  }

  signOut() {
    return this.angularFireAuth.auth.signOut();
  }
}

function fromFirebaseUser(user: firebase.User | undefined): User | undefined {
  if (!user) {
    return undefined;
  }
  return {
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}
