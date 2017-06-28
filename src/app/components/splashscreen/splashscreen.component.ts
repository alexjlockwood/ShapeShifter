import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-splashscreen',
  templateUrl: './splashscreen.component.html',
  styleUrls: ['./splashscreen.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashScreenComponent {}
