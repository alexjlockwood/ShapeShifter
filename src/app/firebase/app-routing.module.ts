import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RootComponent as ProjectEditorComponent } from 'app/editor/components/root/root.component';
import { LoginGuard } from 'app/firebase/core/login.guard';
import { ProjectListComponent } from 'app/firebase/projectlist/projectlist.component';

import { AuthGuard } from './core/auth.guard';
import { LoginComponent } from './login/login.component';
import { ProjectResolver } from './project/project.resolver';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
  { path: 'projects', component: ProjectListComponent, canActivate: [AuthGuard] },
  {
    path: 'project/:id',
    component: ProjectEditorComponent,
    canActivate: [AuthGuard],
    resolve: { data: ProjectResolver },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
