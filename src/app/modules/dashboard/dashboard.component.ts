import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { AuthService } from 'app/core/services/auth';
import { ProjectsService } from 'app/core/services/projects';
import { ProjectItem } from 'app/shared/components/project-grid';
import { Project, User } from 'app/shared/models/firestore';
import { Observable, combineLatest } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  projectItems$: Observable<ReadonlyArray<ProjectItem>>;
  currentUser$: Observable<User | undefined>;

  constructor(
    private readonly angularFirestore: AngularFirestore,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly projectsService: ProjectsService,
    private readonly activatedRoute: ActivatedRoute,
  ) {}

  ngOnInit() {
    const userId = this.activatedRoute.snapshot.paramMap.get('id');
    this.projectItems$ = combineLatest(
      this.authService.observeCurrentUserId(),
      this.projectsService.queryProjectsForUser(userId),
      (currentUserId, projects) => {
        return projects.map(project => {
          return {
            project,
            isOwner: project.userId === currentUserId,
          };
        });
      },
    );
    this.currentUser$ = this.authService.observeCurrentUser();
  }

  // Callback methods for the HeaderComponent.

  onCreateNewProjectClick() {
    this.router.navigateByUrl(`/project/${this.angularFirestore.createId()}`);
  }

  onMyProjectsClick() {
    this.authService
      .observeCurrentUserId()
      .pipe(first())
      .subscribe(userId => this.router.navigateByUrl(`/user/${userId}`));
  }

  onSignInClick() {
    this.authService.showSigninDialog();
  }

  onSignOutClick() {
    this.authService.showSignoutDialog();
  }

  // Callback methods for the ProjectGridComponent.

  onProjectClick(project: Project) {
    this.router.navigateByUrl(`/project/${project.id}`);
  }

  onDeleteProjectClick(project: Project) {
    this.projectsService.deleteProject(project);
  }
}
