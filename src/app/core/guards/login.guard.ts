import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from 'app/core/services/auth.service';
import { first, map, tap } from 'rxjs/operators';

@Injectable()
export class LoginGuard implements CanActivate {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authService.observeUser().pipe(
      first(),
      map(user => !user),
      tap(signedOut => {
        if (!signedOut) {
          console.log('User already logged in');
          this.router.navigate(['/projects']);
        }
      }),
    );
  }
}
