import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { AuthService } from 'app/core/services/auth';
import { AppState } from 'app/core/store';
import { Delete } from 'app/core/store/projects/projects.actions';
import * as fromProjects from 'app/core/store/projects/projects.reducer';
import { Project } from 'app/shared/models/firestore';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  constructor(private readonly store: Store<AppState>, private readonly authService: AuthService) {}

  queryProjects() {
    return this.store.pipe(select(fromProjects.selectAll));
  }

  queryProjectsForUser(userId: string) {
    return this.store.pipe(
      select(fromProjects.selectAll),
      map(projects => projects.filter(p => p.userId === userId)),
    );
  }

  deleteProject(project: Project) {
    this.store.dispatch(new Delete(project.id));
  }
}
