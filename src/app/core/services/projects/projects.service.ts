import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { AppState } from 'app/core/store';
import * as fromProjects from 'app/core/store/projects/projects.reducer';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  constructor(private readonly store: Store<AppState>) {}

  queryProjects() {
    return this.store.pipe(select(fromProjects.selectAll));
  }

  queryProjectsForUser(userId: string) {
    return this.store.pipe(
      select(fromProjects.selectAll),
      map(projects => projects.filter(p => p.userId === userId)),
    );
  }
}
