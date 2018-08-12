import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Project } from 'app/shared/models/firestore';

@Component({
  selector: 'app-projectgrid',
  templateUrl: './projectgrid.component.html',
  styleUrls: ['./projectgrid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectGridComponent {
  @Input()
  projects: ReadonlyArray<Project>;

  constructor(private readonly router: Router) {}

  onProjectClick(project: Project) {
    // TODO: move this into the parent component to keep this component dumb?
    this.router.navigateByUrl(`/project/${project.id}`);
  }

  onDeleteProjectClick(project: Project) {
    // TODO: move this into the parent component to keep this component dumb?
    console.log('deleting project', project);
  }

  trackByFn(index: number, project: Project) {
    return project.id;
  }
}
