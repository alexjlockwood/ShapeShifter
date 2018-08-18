import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { AngularFireAuth } from 'angularfire2/auth';
import { AppState } from 'app/core/store';
import { SetUser, ShowSigninDialog, ShowSignoutDialog } from 'app/core/store/auth/auth.actions';
import { User } from 'app/shared/models/firestore';
import * as firebase from 'firebase/app';
import * as _ from 'lodash';
import { distinctUntilChanged, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private readonly angularFireAuth: AngularFireAuth,
    private readonly store: Store<AppState>,
  ) {
    // TODO: investigate if we should be reading this from the fire store instead?
    // TODO: should we set the user to the firestore here?
    // return this.angularFirestore.doc<User>(`users/${user.uid}`).valueChanges();
    this.angularFireAuth.authState.subscribe(user => {
      this.store.dispatch(new SetUser(fromFirebaseUser(user)));
    });
  }

  observeCurrentUser() {
    return this.store.pipe(select(state => state.auth.user), distinctUntilChanged<User>(_.isEqual));
  }

  observeCurrentUserId() {
    return this.observeCurrentUser().pipe(
      map(user => (user ? user.id : undefined)),
      distinctUntilChanged(),
    );
  }

  observeIsAuthenticated() {
    return this.observeCurrentUser().pipe(map(user => !!user));
  }

  showSigninDialog() {
    this.store.dispatch(new ShowSigninDialog());
  }

  showSignoutDialog() {
    this.store.dispatch(new ShowSignoutDialog());
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
