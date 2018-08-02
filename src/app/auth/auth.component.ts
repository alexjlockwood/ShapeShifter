import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/core';

@Component({
  templateUrl: 'auth.component.html',
  styleUrls: ['auth.component.scss'],
})
export class AuthComponent {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  signInWithGoogle() {
    this.authService
      .signInWithGoogle()
      .then(() => this.router.navigateByUrl('/projects'))
      .catch(() => console.error('Unable to login'));
  }
}
