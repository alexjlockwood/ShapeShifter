import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFirestore, AngularFirestoreDocument } from 'angularfire2/firestore';
import * as firebase from 'firebase/app';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface User {
  uid: string;
  email?: string;
  photoURL?: string;
  displayName?: string;
}

@Injectable()
export class AuthService {
  private readonly user: Observable<User | undefined>;

  constructor(
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFirestore: AngularFirestore,
    private readonly router: Router,
  ) {
    this.user = this.angularFireAuth.authState.pipe(
      switchMap(user => {
        if (!user) {
          return of(undefined);
        }
        return this.angularFirestore.doc<User>(`users/${user.uid}`).valueChanges();
      }),
    );
  }

  observeUser() {
    return this.user;
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
    console.log('updating user data', user);

    return this.angularFirestore.doc<User>(`users/${user.uid}`).set(
      {
        uid: user.uid,
        email: user.email,
        photoURL: user.photoURL,
        displayName: user.displayName,
      },
      { merge: true },
    );
  }

  signOut() {
    return this.angularFireAuth.auth.signOut();
  }
}
