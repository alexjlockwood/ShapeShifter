import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { AuthService } from 'app/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface FirestoreProject {
  readonly id: string;
  readonly name: string;
  readonly uid: string;
  readonly content: string;
}

@Component({
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  readonly projects: Observable<FirestoreProject[]>;

  constructor(
    private readonly angularFirestore: AngularFirestore,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.projects = angularFirestore
      .collection<FirestoreProject>('projects')
      .snapshotChanges()
      .pipe(
        map(actions => {
          return actions.map(action => {
            const project = action.payload.doc.data() as FirestoreProject;
            const id = action.payload.doc.id;
            return { id, ...project };
          });
        }),
      );
  }

  newProject() {
    this.router.navigateByUrl(`/project/${this.angularFirestore.createId()}`);
  }

  signOut() {
    this.authService
      .signOut()
      .then(() => this.router.navigateByUrl('/login'))
      .catch(() => console.log('Failed to sign out'));
  }
}
