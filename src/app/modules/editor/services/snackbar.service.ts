export enum Duration {
  Short = 2750,
  Long = 5000,
}

export interface SnackBar {
  readonly key: number;
  readonly message: string;
  readonly action: string;
  readonly duration: Duration;
}

/**
 * Shows short messages at the bottom of the screen. A new message replaces the current one.
 */
export class SnackBarService {
  private snackBar: SnackBar | undefined;
  private numSnackBars = 0;
  private readonly listeners = new Set<() => void>();

  show(message: string, action = '', duration = Duration.Short) {
    this.snackBar = { key: ++this.numSnackBars, message, action: action.toUpperCase(), duration };
    this.listeners.forEach(listener => listener());
  }

  dismiss() {
    this.snackBar = undefined;
    this.listeners.forEach(listener => listener());
  }

  getSnackBar() {
    return this.snackBar;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
