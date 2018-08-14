import { Injectable } from '@angular/core';
import { Actions, Effect } from '@ngrx/effects';
import { AngularFirestore } from 'angularfire2/firestore';
import { Project } from 'app/shared/models/firestore';
import { from } from 'rxjs';
import { map, mergeMap, switchMap } from 'rxjs/operators';

import {
  Added,
  Create,
  Delete,
  Modified,
  ProjectsActionTypes,
  Query,
  Removed,
  Success,
  Update,
} from './projects.actions';

/**
 * TODO: dispatch a failure action when failures occur
 * TODO: figure out how to efficiently update the store after create/update/delete actions
 * TODO: figure out if switchMap is being used correctly in write operations below
 */
@Injectable()
export class ProjectsEffects {
  @Effect()
  query$ = this.actions$.ofType<Query>(ProjectsActionTypes.Query).pipe(
    switchMap(() => this.afs.collection<Project>('projects').stateChanges()),
    mergeMap(actions => actions),
    map(({ type, payload }) => {
      const project = payload.doc.data();
      return type === 'added'
        ? new Added(project)
        : type === 'modified'
          ? new Modified(project)
          : new Removed(project);
    }),
  );

  @Effect()
  create$ = this.actions$.ofType<Create>(ProjectsActionTypes.Create).pipe(
    switchMap(({ project }) => from(this.afs.doc<Project>(`projects/${project.id}`).set(project))),
    map(() => new Success()),
  );

  @Effect()
  update$ = this.actions$.ofType<Update>(ProjectsActionTypes.Update).pipe(
    switchMap(({ projectId, changes }) =>
      from(this.afs.doc<Project>(`projects/${projectId}`).update(changes)),
    ),
    map(() => new Success()),
  );

  @Effect()
  delete$ = this.actions$.ofType<Delete>(ProjectsActionTypes.Delete).pipe(
    switchMap(({ projectId }) => from(this.afs.doc<Project>(`projects/${projectId}`).delete())),
    map(() => new Success()),
  );

  constructor(private readonly actions$: Actions, private readonly afs: AngularFirestore) {}
}
