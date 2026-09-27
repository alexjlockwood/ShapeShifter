export enum Duration {
  Short = 2750,
  Long = 5000,
}

export interface SnackBar {
  readonly key: number;
  readonly message: string;
  readonly action: string;
  readonly duration: Duration;
  // Called when the action's button is clicked, after the message is dismissed.
  readonly onAction?: () => void;
}

/**
 * Shows short messages at the bottom of the screen. A new message replaces the current one.
 */
export class SnackBarService {
  private snackBar: SnackBar | undefined;
  private numSnackBars = 0;
  // The messages whose button was clicked. The host keeps showing a dismissed message while it
  // animates away, so its button can be clicked again.
  private readonly clicked = new WeakSet<SnackBar>();
  private readonly listeners = new Set<() => void>();

  /**
   * Shows the message with a button labeled with the action, if any. The button dismisses the
   * message, and then calls onAction.
   */
  show(message: string, action = '', duration = Duration.Short, onAction?: () => void) {
    this.snackBar = {
      key: ++this.numSnackBars,
      message,
      action: action.toUpperCase(),
      duration,
      onAction,
    };
    this.listeners.forEach(listener => listener());
  }

  dismiss() {
    this.snackBar = undefined;
    this.listeners.forEach(listener => listener());
  }

  /**
   * Handles a click on the message's button: it dismisses the message, if it's still showing, and
   * calls its onAction, once per message. The action can show another message.
   */
  clickAction(snackBar: SnackBar) {
    if (this.clicked.has(snackBar)) {
      return;
    }
    this.clicked.add(snackBar);
    if (this.snackBar === snackBar) {
      this.dismiss();
    }
    snackBar.onAction?.();
  }

  // These are arrow functions so that they can be passed to useSyncExternalStore.
  readonly getSnackBar = () => this.snackBar;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
