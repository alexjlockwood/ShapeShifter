import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AngularFireAuth } from 'angularfire2/auth';
import { UserService } from 'app/routing/core/user.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    public afAuth: AngularFireAuth,
    public userService: UserService,
    private router: Router,
  ) {}

  canActivate(): Promise<boolean> {
    return new Promise(resolve => {
      this.userService.getCurrentUser().then(
        () => {
          this.router.navigate(['/user']);
          return resolve(false);
        },
        () => {
          return resolve(true);
        },
      );
    });
  }
}
