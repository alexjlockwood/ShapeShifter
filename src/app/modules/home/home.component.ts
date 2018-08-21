import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from 'angularfire2/firestore';
import { AuthService } from 'app/core/services/auth';
import { User } from 'app/shared/models/firestore';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  currentUser$: Observable<User | undefined>;

  constructor(
    private readonly angularFirestore: AngularFirestore,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.currentUser$ = this.authService.observeCurrentUser();
  }

  // Callback methods for the HeaderComponent.

  onCreateNewProjectClick() {
    this.router.navigateByUrl(`/project/${this.angularFirestore.createId()}`);
  }

  onMyProjectsClick() {
    this.authService
      .observeCurrentUser()
      .pipe(first())
      .subscribe(user => this.router.navigateByUrl(`/user/${user.id}`));
  }

  onSignInClick() {
    this.authService.showSigninDialog();
  }

  onSignOutClick() {
    this.authService.showSignoutDialog();
  }
}
