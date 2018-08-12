import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFirestore } from 'angularfire2/firestore';
import * as fromCore from 'app/core/store/core.reducer';
import { User } from 'app/shared/models/firestore';
import * as firebase from 'firebase/app';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { SetUser } from '../store/auth.actions';

@Injectable()
export class AuthService {
  constructor(
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFirestore: AngularFirestore,
    private readonly store: Store<fromCore.State>,
  ) {
    this.angularFireAuth.authState
      .pipe(
        switchMap(user => {
          if (!user) {
            return of<User>(undefined);
          }
          // TODO: investigate the best way to speed this query up (should appear to be immediate)
          return this.angularFirestore.doc<User>(`users/${user.uid}`).valueChanges();
        }),
      )
      .subscribe(user => this.store.dispatch(new SetUser(user)));
  }

  observeUser() {
    return this.store.pipe(select(state => state.auth.user));
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
