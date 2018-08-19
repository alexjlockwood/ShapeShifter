import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { User } from 'app/shared/models/firestore';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  @Input()
  currentUser: User | undefined;

  @Output()
  createNewProjectClick = new EventEmitter<undefined>();
  @Output()
  myProjectsClick = new EventEmitter<undefined>();
  @Output()
  signInClick = new EventEmitter<undefined>();
  @Output()
  signOutClick = new EventEmitter<undefined>();

  onCreateNewProjectClick() {
    this.createNewProjectClick.emit();
  }

  onMyProjectsClick() {
    this.myProjectsClick.emit();
  }

  onSignInClick() {
    this.signInClick.emit();
  }

  onSignOutClick() {
    this.signOutClick.emit();
  }
}
