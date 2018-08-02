import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { RootComponent as EditorComponent } from './editor/components/root/root.component';
import { AuthGuard } from './firebase/core/auth.guard';
import { LoginGuard } from './firebase/core/login.guard';
import { LoginComponent } from './firebase/login/login.component';
import { ProjectResolver } from './firebase/project/project.resolver';
import { ProjectListComponent } from './firebase/projectlist/projectlist.component';

// export const appRoutes: Routes = [
//   { path: '', redirectTo: 'login', pathMatch: 'full' },
//   { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
//   { path: 'projects', component: ProjectListComponent, canActivate: [AuthGuard] },
//   {
//     path: 'project/:id',
//     component: EditorComponent,
//     canActivate: [AuthGuard],
//     resolve: { data: ProjectResolver },
//   },
// ];

// @NgModule({
//   imports: [RouterModule.forRoot(appRoutes)],
//   exports: [RouterModule],
// })
// export class AppRoutingModule {}

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
  { path: 'projects', component: ProjectListComponent, canActivate: [AuthGuard] },
  {
    path: 'project',
    loadChildren: './editor/editor.module#EditorModule',
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      // TODO: investigate implementing a custom preloading strategy
      // preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
