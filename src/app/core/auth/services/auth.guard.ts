import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { first, tap } from 'rxjs/operators';

import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authService.observeIsAuthenticated().pipe(
      first(),
      tap(isAuthenticated => {
        if (!isAuthenticated) {
          console.log('Access denied.');
          this.router.navigate(['/']);
        }
      }),
    );
  }
}
