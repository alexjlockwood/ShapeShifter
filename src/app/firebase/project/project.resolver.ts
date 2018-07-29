import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { Project } from 'app/components/project';
import { AuthService } from 'app/firebase/core/auth.service';
import { ModelUtil } from 'app/scripts/common';
import { FileExportService } from 'app/services';
import { combineLatest, from, of } from 'rxjs';
import { first, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';

// TODO: generate this server side instead?
const defaultProjectContent = JSON.stringify({
  version: 1,
  layers: {
    vectorLayer: {
      id: '1',
      name: 'myVector',
      type: 'vector',
      width: 24,
      height: 24,
      children: [] as string[],
    },
    hiddenLayerIds: [] as string[],
  },
  timeline: { animation: { id: '2', name: 'anim', duration: 300, blocks: [] as string[] } },
});

interface FirestoreProject {
  readonly name: string;
  readonly uid: string;
  readonly content: string;
}

@Injectable()
export class ProjectResolver implements Resolve<Project> {
  constructor(
    private readonly router: Router,
    private readonly angularFirestore: AngularFirestore,
    private readonly authService: AuthService,
  ) {}

  resolve(route: ActivatedRouteSnapshot) {
    const id = route.paramMap.get('id');
    const observeUserUid = this.authService.observeUser().pipe(map(user => user.uid));
    const observeDocPayload = this.angularFirestore
      .doc<FirestoreProject>(`projects/${id}`)
      .snapshotChanges()
      .pipe(map(action => action.payload));
    return combineLatest(observeUserUid, observeDocPayload)
      .pipe(
        switchMap(([uid, payload]) => {
          if (!payload.exists) {
            const firestoreProject = {
              id,
              uid,
              name: 'my new project',
              content: defaultProjectContent,
            };
            return from<Project>(
              this.angularFirestore
                .collection<FirestoreProject>('projects')
                .doc(id)
                .set(firestoreProject)
                .then(() => {
                  console.log('success');
                  return this.fromFirestoreProject(firestoreProject);
                })
                .catch(() => {
                  console.log('error');
                  return undefined;
                }),
            );
          }
          return of(this.fromFirestoreProject(payload.data()));
        }),
      )
      .pipe(first());
  }

  private fromFirestoreProject(firestoreProject: FirestoreProject) {
    const { vectorLayer, animation, hiddenLayerIds } = FileExportService.fromJSON(
      JSON.parse(firestoreProject.content),
    );
    return ModelUtil.regenerateModelIds(vectorLayer, animation, hiddenLayerIds) as Project;
  }
}
