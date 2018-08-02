import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'app/core/guards/auth.guard';

const routes: Routes = [
  {
    path: 'project',
    loadChildren: './editor/editor.module#EditorModule',
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      // TODO: investigate implementing a custom preloading strategy
      preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
