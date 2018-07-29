import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from 'app/firebase/core/auth.service';
import { first, map, tap } from 'rxjs/operators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authService.observeUser().pipe(
      first(),
      map(user => !!user),
      tap(signedIn => {
        if (!signedIn) {
          console.log('Access denied.');
          this.router.navigate(['/login']);
        }
      }),
    );
  }
}
