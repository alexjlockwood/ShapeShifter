import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'app/core';

import { RootComponent } from './components/root/root.component';
import { ProjectResolver } from './project.resolver';

const routes: Routes = [
  {
    path: ':id',
    component: RootComponent,
    // TODO: remove this? make it possible to enter this screen w/o logging in?
    canActivate: [AuthGuard],
    resolve: { data: ProjectResolver },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EditorRoutingModule {}
