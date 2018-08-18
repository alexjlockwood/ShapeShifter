import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AngularFirestore } from 'angularfire2/firestore';
import { AuthService } from 'app/core/services/auth';
import { ProjectsService } from 'app/core/services/projects';
import { ShowSignoutDialog } from 'app/core/store/auth/auth.actions';
import { State } from 'app/core/store/core.reducer';
import { Project } from 'app/shared/models/firestore';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, first, map, switchMap } from 'rxjs/operators';

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
    private readonly store: Store<State>,
    projectsService: ProjectsService,
  ) {
    this.projects$ = this.authService.observeUser().pipe(
      map(user => (user ? user.id : undefined)),
      distinctUntilChanged(),
      switchMap(userId => {
        if (!userId) {
          return of([] as Project[]);
        }
        return projectsService.queryProjectsForUser(userId);
      }),
    );
    this.isAuthenticated$ = this.authService.observeIsAuthenticated();
  }

  onCreateNewProjectClick() {
    this.router.navigateByUrl(`/project/${this.angularFirestore.createId()}`);
  }

  onMyProjectsClick() {
    this.authService
      .observeUser()
      .pipe(first())
      .subscribe(user => this.router.navigateByUrl(`/user/${user.id}`));
  }

  onSignInClick() {
    this.authService
      .signInWithGoogle()
      .then(() => this.router.navigateByUrl('/'))
      .catch(() => console.error('Unable to login'));
  }

  onSignOutClick() {
    this.store.dispatch(new ShowSignoutDialog());
  }
}
