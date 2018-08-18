import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from 'environments/environment';

import { metaReducers, reducers } from './appstore.reducer';
import { AuthEffects } from './auth/auth.effects';
import { ProjectsEffects } from './projects/projects.effects';
import { RouterEffects } from './router/router.effects';

@NgModule({
  imports: [
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot([AuthEffects, ProjectsEffects, RouterEffects]),
    StoreRouterConnectingModule.forRoot(),
    ...(environment.production ? [] : [StoreDevtoolsModule.instrument()]),
  ],
})
export class AppStoreModule {}
