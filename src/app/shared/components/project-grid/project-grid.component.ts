import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Project } from 'app/shared/models/firestore';

@Component({
  selector: 'app-project-grid',
  templateUrl: './project-grid.component.html',
  styleUrls: ['./project-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectGridComponent {
  @Input()
  projects: ReadonlyArray<Project>;

  @Output()
  projectClick = new EventEmitter<Project>();
  @Output()
  deleteProjectClick = new EventEmitter<Project>();

  constructor(private readonly router: Router) {}

  onProjectClick(project: Project) {
    this.projectClick.emit(project);
  }

  onDeleteProjectClick(project: Project) {
    this.deleteProjectClick.emit(project);
  }

  trackByFn(index: number, project: Project) {
    return project.id;
  }
}
