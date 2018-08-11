import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  @Input()
  isAuthenticated: boolean;

  @Output()
  createNewProjectClick = new EventEmitter<undefined>();
  @Output()
  signInClick = new EventEmitter<undefined>();
  @Output()
  signOutClick = new EventEmitter<undefined>();

  onCreateNewProjectClick() {
    this.createNewProjectClick.emit();
  }

  onSignInClick() {
    this.signInClick.emit();
  }

  onSignOutClick() {
    this.signOutClick.emit();
  }
}
