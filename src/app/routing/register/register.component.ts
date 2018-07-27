import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'app/routing/core/auth.service';
import { environment } from 'environments/environment';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  readonly isGoogleLoginEnabled = environment.isGoogleLoginEnabled;
  readonly isFacebookLoginEnabled = environment.isFacebookLoginEnabled;
  readonly isTwitterLoginEnabled = environment.isTwitterLoginEnabled;

  registerForm: FormGroup;
  errorMessage = '';
  successMessage = '';

  constructor(public authService: AuthService, private router: Router, private fb: FormBuilder) {
    this.registerForm = this.fb.group({
      email: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  tryFacebookLogin() {
    this.authService
      .doFacebookLogin()
      .then(() => this.router.navigate(['/user']), err => console.log(err));
  }

  tryTwitterLogin() {
    this.authService
      .doTwitterLogin()
      .then(() => this.router.navigate(['/user']), err => console.log(err));
  }

  tryGoogleLogin() {
    this.authService
      .doGoogleLogin()
      .then(() => this.router.navigate(['/user']), err => console.log(err));
  }

  tryRegister(value: any) {
    this.authService.doRegister(value).then(
      res => {
        console.log(res);
        this.errorMessage = '';
        this.successMessage = 'Your account has been created';
      },
      err => {
        console.log(err);
        this.errorMessage = err.message;
        this.successMessage = '';
      },
    );
  }
}
