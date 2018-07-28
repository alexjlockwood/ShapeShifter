import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { Project, ProjectService } from 'app/components/project';
import { from } from 'rxjs';
import { first, map } from 'rxjs/operators';

@Injectable()
export class ProjectResolver implements Resolve<Project> {
  constructor(private readonly router: Router, private readonly projectService: ProjectService) {}

  resolve(route: ActivatedRouteSnapshot) {
    const id = route.paramMap.get('id');
    console.log(id);

    return from(this.projectService.getProject(`demos/${id}.shapeshifter`)).pipe(
      first(),
      map(project => {
        if (project) {
          return project;
        }
        this.router.navigate(['/login']);
        return undefined;
      }),
    );
    // TODO: fetch this from firebase instead
    // return this.projectService.getProject(`demos/${id}.shapeshifter`).then(
    //   project => {
    //     console.log(project);
    //     return project;
    //   },
    //   err => {
    //     this.router.navigate(['/login']);
    //     return undefined;
    //   },
    // );
  }
}
