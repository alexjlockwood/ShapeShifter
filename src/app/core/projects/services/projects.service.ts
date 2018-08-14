import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import * as fromProjects from 'app/core/projects/store/projects.reducer';
import * as fromCore from 'app/core/store/core.reducer';

@Injectable()
export class ProjectsService {
  constructor(private readonly store: Store<fromCore.State>) {}

  observeProjects() {
    return this.store.pipe(select(fromProjects.selectAll));
  }
}
