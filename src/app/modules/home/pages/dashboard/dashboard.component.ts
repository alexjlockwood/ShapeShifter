import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'app/core/services/auth';
import { ProjectsService } from 'app/core/services/projects';
import { ProjectItem } from 'app/shared/components/project-grid';
import { Project } from 'app/shared/models/firestore';
import { Observable, combineLatest } from 'rxjs';

@Component({
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  projectItems$: Observable<ReadonlyArray<ProjectItem>>;

  constructor(
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
  }

  // Callback methods for the ProjectGridComponent.

  onProjectClick(project: Project) {
    this.router.navigateByUrl(`/project/${project.id}`);
  }

  onDeleteProjectClick(project: Project) {
    this.projectsService.deleteProject(project);
  }
}
