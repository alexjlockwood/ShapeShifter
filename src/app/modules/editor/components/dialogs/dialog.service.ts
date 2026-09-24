import { DemoInfo } from 'app/modules/editor/scripts/demos';

export enum DropFilesAction {
  AddToWorkspace = 1,
  ResetWorkspace,
}

export type DialogRequest =
  | {
      readonly type: 'confirm';
      readonly title: string;
      readonly message: string;
      readonly close: (result?: boolean) => void;
    }
  | { readonly type: 'pickDemo'; readonly close: (result?: DemoInfo) => void }
  | { readonly type: 'dropFiles'; readonly close: (result?: DropFilesAction) => void };

/**
 * Opens the app's dialogs. Each method resolves once the dialog is closed, with undefined if it
 * was dismissed.
 */
export class DialogService {
  private request: DialogRequest | undefined;
  private readonly listeners = new Set<() => void>();

  confirm(title: string, message: string) {
    return new Promise<boolean | undefined>(resolve => {
      this.open({ type: 'confirm', title, message, close: this.closeFn(resolve) });
    });
  }

  pickDemo() {
    return new Promise<DemoInfo | undefined>(resolve => {
      this.open({ type: 'pickDemo', close: this.closeFn(resolve) });
    });
  }

  dropFiles() {
    return new Promise<DropFilesAction | undefined>(resolve => {
      this.open({ type: 'dropFiles', close: this.closeFn(resolve) });
    });
  }

  getRequest() {
    return this.request;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private open(request: DialogRequest) {
    // Only one dialog is shown at a time, so dismiss the current one (if any).
    this.request?.close();
    this.request = request;
    this.listeners.forEach(listener => listener());
  }

  private closeFn<T>(resolve: (result?: T) => void) {
    return (result?: T) => {
      this.request = undefined;
      this.listeners.forEach(listener => listener());
      resolve(result);
    };
  }
}
