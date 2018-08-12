import { Injectable } from '@angular/core';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFirestore } from 'angularfire2/firestore';
import { User } from 'app/shared/models/firestore';
import * as firebase from 'firebase/app';
import { Observable, of } from 'rxjs';
import { concat, map, switchMap } from 'rxjs/operators';

@Injectable()
export class AuthService {
  private readonly user$: Observable<User | undefined>;

  constructor(
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFirestore: AngularFirestore,
  ) {
    this.user$ = this.angularFireAuth.authState.pipe(
      switchMap(user => {
        if (!user) {
          return of(undefined);
        }
        // TODO: investigate the best way to speed this query up (should appear to be immediate)
        return this.angularFirestore.doc<User>(`users/${user.uid}`).valueChanges();
      }),
    );
  }

  observeUser() {
    return this.user$;
  }

  observeIsAuthenticated() {
    return this.user$.pipe(map(user => !!user));
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
