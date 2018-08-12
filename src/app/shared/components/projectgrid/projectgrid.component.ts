import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Project } from 'app/shared/models';

@Component({
  selector: 'app-projectgrid',
  templateUrl: './projectgrid.component.html',
  styleUrls: ['./projectgrid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectGridComponent {
  @Input()
  projects: ReadonlyArray<Project>;

  trackByFn(index: number, project: Project) {
    return project.id;
  }
}
