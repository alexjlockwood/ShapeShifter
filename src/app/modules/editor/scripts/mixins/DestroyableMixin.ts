import { Subscription } from 'rxjs';

export function DestroyableMixin<T extends Constructor>(Base = class {} as T) {
  return class extends Base {
    private readonly subscriptions: Subscription[] = [];

    protected registerSubscription(sub: Subscription) {
      this.subscriptions.push(sub);
    }

    dispose() {
      this.subscriptions.forEach(x => x.unsubscribe());
    }
  };
}
