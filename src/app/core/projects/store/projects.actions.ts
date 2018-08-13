import { Action } from '@ngrx/store';
import { Project } from 'app/shared/models/firestore';

export enum ProjectsActionTypes {
  Query = '[projects] Query',
  Create = '[projects] Create',
  Update = '[projects] Update',
  Delete = '[projects] Delete',
  AddAll = '[projects] AddAll',
  Success = '[projects] Success',
}

export class Query implements Action {
  readonly type = ProjectsActionTypes.Query;
}

export class Create implements Action {
  readonly type = ProjectsActionTypes.Create;
  constructor(readonly project: Project) {}
}

export class Update implements Action {
  readonly type = ProjectsActionTypes.Update;
  constructor(readonly projectId: string, readonly changes: Partial<Project>) {}
}

export class Delete implements Action {
  readonly type = ProjectsActionTypes.Delete;
  constructor(readonly projectId: string) {}
}

export class AddAll implements Action {
  readonly type = ProjectsActionTypes.AddAll;
  constructor(readonly projects: ReadonlyArray<Project>) {}
}

export class Success implements Action {
  readonly type = ProjectsActionTypes.Success;
}

export type ProjectsActions = Query | Create | Update | Delete | AddAll | Success;
