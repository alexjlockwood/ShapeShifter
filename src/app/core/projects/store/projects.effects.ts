import { Injectable } from '@angular/core';
import { Actions, Effect } from '@ngrx/effects';
import { AngularFirestore } from 'angularfire2/firestore';
import { Project } from 'app/shared/models/firestore';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import {
  AddAll,
  Create,
  Delete,
  ProjectsActionTypes,
  Query,
  Success,
  Update,
} from './projects.actions';

/**
 * TODO: figure out how to handle failures
 * TODO: figure out how to efficiently update the store after create/update/delete actions
 */
@Injectable()
export class PizzaEffects {
  @Effect()
  query$ = this.actions$.ofType<Query>(ProjectsActionTypes.Query).pipe(
    switchMap(action => this.afs.collection<Project>('projects').valueChanges()),
    map(projects => new AddAll(projects)),
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
