import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { AuthService } from 'app/core';
import { Project } from 'app/shared/models';
import { Observable } from 'rxjs';
import { first, map } from 'rxjs/operators';

@Component({
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly projects$: Observable<ReadonlyArray<Project>>;
  readonly isAuthenticated$: Observable<boolean>;

  constructor(
    private readonly angularFirestore: AngularFirestore,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.projects$ = angularFirestore
      .collection<Project>('projects')
      .snapshotChanges()
      .pipe(
        map(actions => {
          return actions.map(action => {
            const project = action.payload.doc.data() as Project;
            const id = action.payload.doc.id;
            return { id, ...project };
          });
        }),
      );
    this.isAuthenticated$ = this.authService.observeIsAuthenticated();
  }

  onProjectClick(project: Project) {
    this.router.navigateByUrl(`/project/${project.id}`);
  }

  onCreateNewProjectClick() {
    this.router.navigateByUrl(`/project/${this.angularFirestore.createId()}`);
  }

  onMyProjectsClick() {
    this.authService
      .observeUser()
      .pipe(first())
      .subscribe(user => this.router.navigateByUrl(`/user/${user.uid}`));
  }

  onSignInClick() {
    this.authService
      .signInWithGoogle()
      .then(() => this.router.navigateByUrl('/'))
      .catch(() => console.error('Unable to login'));
  }

  onSignOutClick() {
    this.authService
      .signOut()
      .then(() => this.router.navigateByUrl('/'))
      .catch(() => console.log('Failed to sign out'));
  }
}
