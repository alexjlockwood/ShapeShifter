import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { Project, ProjectService } from 'app/components/project';
import { ModelUtil } from 'app/scripts/common';
import { FileExportService } from 'app/services';
import { from } from 'rxjs';
import { first, map } from 'rxjs/operators';

@Injectable()
export class ProjectResolver implements Resolve<Project> {
  constructor(
    private readonly router: Router,
    private readonly angularFirestore: AngularFirestore,
  ) {}

  resolve(route: ActivatedRouteSnapshot) {
    const id = route.paramMap.get('id');
    const document = this.angularFirestore.doc(`projects/${id}`);
    return document.valueChanges().pipe(
      first(),
      map((project: any) => {
        // TODO: get rid of any type above
        if (project) {
          const { vectorLayer, animation, hiddenLayerIds } = FileExportService.fromJSON(
            JSON.parse(project.content),
          );
          return ModelUtil.regenerateModelIds(vectorLayer, animation, hiddenLayerIds) as Project;
        }
        this.router.navigate(['/login']);
        return undefined;
      }),
    );
  }
}
