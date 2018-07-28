import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'app/firebase/core/auth.service';
import { environment } from 'environments/environment';
import * as firebase from 'firebase/app';

@Component({
  selector: 'app-login',
  templateUrl: 'login.component.html',
  styleUrls: ['login.component.scss'],
})
export class LoginComponent {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  signInWithGoogle() {
    this.authService
      .signInWithGoogle()
      .then(() => this.router.navigateByUrl('/projects'))
      .catch(() => console.error('Unable to login'));
  }
}
