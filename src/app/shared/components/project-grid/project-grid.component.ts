import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Project } from 'app/shared/models/firestore';

@Component({
  selector: 'app-project-grid',
  templateUrl: './project-grid.component.html',
  styleUrls: ['./project-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectGridComponent {
  @Input()
  projectItems: ReadonlyArray<ProjectItem>;

  @Output()
  projectClick = new EventEmitter<Project>();
  @Output()
  deleteProjectClick = new EventEmitter<Project>();

  onProjectClick(project: Project) {
    this.projectClick.emit(project);
  }

  onDeleteProjectClick(project: Project) {
    this.deleteProjectClick.emit(project);
  }

  trackByFn(index: number, projectItem: ProjectItem) {
    return projectItem.project.id;
  }
}

export interface ProjectItem {
  // The firestore project to display.
  readonly project: Project;
  // True iff the signed in user owns this project.
  readonly isOwner: boolean;
}
