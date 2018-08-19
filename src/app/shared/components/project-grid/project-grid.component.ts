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

  lottieConfig: Object;
  private anim: any;
  private animationSpeed = 1;

  constructor() {
    this.lottieConfig = {
      path: 'assets/pinjump.json',
      autoplay: true,
      loop: true,
    };
  }

  onProjectClick(project: Project) {
    this.projectClick.emit(project);
  }

  onDeleteProjectClick(project: Project) {
    this.deleteProjectClick.emit(project);
  }

  trackByFn(index: number, projectItem: ProjectItem) {
    return projectItem.project.id;
  }

  // TODO: implement this?
  handleAnimation() {}
}

export interface ProjectItem {
  // The firestore project to display.
  readonly project: Project;
  // True iff the signed in user owns this project.
  readonly isOwner: boolean;
}
