import { Icon } from 'app/modules/editor/components/icons/Icon';

import './splashscreen.scss';

export function SplashScreen() {
  return (
    <div className="app-splashscreen fx-column fx-align-center">
      <Icon className="splashscreen-logo" name="shapeshifter" />
      <div className="splashscreen-text">
        Shape Shifter is an icon animation tool designed for desktop browsers
      </div>
    </div>
  );
}
