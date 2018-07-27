import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'app/routing/core/auth.service';
import { environment } from 'environments/environment';

@Component({
  selector: 'app-page-login',
  templateUrl: 'login.component.html',
  styleUrls: ['login.component.scss'],
})
export class LoginComponent {
  readonly isEmailPasswordLoginEnabled = environment.isEmailPasswordLoginEnabled;
  readonly isGoogleLoginEnabled = environment.isGoogleLoginEnabled;
  readonly isFacebookLoginEnabled = environment.isFacebookLoginEnabled;
  readonly isTwitterLoginEnabled = environment.isTwitterLoginEnabled;

  loginForm: FormGroup;
  errorMessage = '';

  constructor(public authService: AuthService, private router: Router, private fb: FormBuilder) {
    this.createForm();
  }

  createForm() {
    this.loginForm = this.fb.group({
      email: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  tryFacebookLogin() {
    this.authService.doFacebookLogin().then(() => {
      this.router.navigate(['/user']);
    });
  }

  tryTwitterLogin() {
    this.authService.doTwitterLogin().then(() => {
      this.router.navigate(['/user']);
    });
  }

  tryGoogleLogin() {
    this.authService.doGoogleLogin().then(() => {
      this.router.navigate(['/user']);
    });
  }

  tryLogin(value: any) {
    this.authService.doLogin(value).then(
      () => {
        this.router.navigate(['/user']);
      },
      err => {
        console.log(err);
        this.errorMessage = err.message;
      },
    );
  }
}
