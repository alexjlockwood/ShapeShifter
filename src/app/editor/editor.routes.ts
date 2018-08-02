import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'app/firebase/core/auth.guard';
import { ProjectResolver } from 'app/firebase/project/project.resolver';

import { RootComponent } from './components/root/root.component';

const routes: Routes = [
  {
    path: ':id',
    component: RootComponent,
    canActivate: [AuthGuard],
    resolve: { data: ProjectResolver },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EditorRoutingModule {}
