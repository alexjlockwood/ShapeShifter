import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { AuthService } from 'app/core/services/auth';
import { ProjectsService } from 'app/core/services/projects';
import { Project } from 'app/shared/models/firestore';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, first, map, switchMap } from 'rxjs/operators';

@Component({
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly projects$: Observable<ReadonlyArray<Project>>;
  readonly isAuthenticated$: Observable<boolean>;

  constructor(
    private readonly angularFirestore: AngularFirestore,
    private readonly authService: AuthService,
    private readonly router: Router,
    projectsService: ProjectsService,
  ) {
    this.projects$ = this.authService.observeCurrentUser().pipe(
      map(user => (user ? user.id : undefined)),
      distinctUntilChanged(),
      switchMap(userId => {
        if (!userId) {
          return of([] as Project[]);
        }
        return projectsService.queryProjects();
      }),
    );
    this.isAuthenticated$ = this.authService.observeIsAuthenticated();
  }

  onCreateNewProjectClick() {
    this.router.navigateByUrl(`/project/${this.angularFirestore.createId()}`);
  }

  onMyProjectsClick() {
    this.authService
      .observeCurrentUser()
      .pipe(first())
      .subscribe(user => this.router.navigateByUrl(`/user/${user.id}`));
  }

  onSignInClick() {
    this.authService.showSigninDialog();
  }

  onSignOutClick() {
    this.authService.showSignoutDialog();
  }

  onProjectClick(project: Project) {
    this.router.navigateByUrl(`/project/${project.id}`);
  }

  onDeleteProjectClick(project: Project) {
    console.log('TODO: implement delete project');
  }
}
