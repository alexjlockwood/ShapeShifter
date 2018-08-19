import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { AuthService } from 'app/core/services/auth';
import { ProjectsService } from 'app/core/services/projects';
import { ProjectItem } from 'app/shared/components/project-grid';
import { Project, User } from 'app/shared/models/firestore';
import { Observable, combineLatest } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  projectItems$: Observable<ReadonlyArray<ProjectItem>>;
  currentUser$: Observable<User | undefined>;

  lottieConfig: Object;
  private anim: any;
  private animationSpeed = 1;

  constructor(
    private readonly angularFirestore: AngularFirestore,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly projectsService: ProjectsService,
  ) {
    this.lottieConfig = {
      path: 'assets/pinjump.json',
      autoplay: true,
      loop: true,
    };
  }

  ngOnInit() {
    this.projectItems$ = combineLatest(
      this.authService.observeCurrentUserId(),
      this.projectsService.queryProjects(),
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

  // Callback methods for the ProjectGridComponent.

  onProjectClick(project: Project) {
    this.router.navigateByUrl(`/project/${project.id}`);
  }

  onDeleteProjectClick(project: Project) {
    this.projectsService.deleteProject(project);
  }

  handleAnimation(event: any) {}
}
