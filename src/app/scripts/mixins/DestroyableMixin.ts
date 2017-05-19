import { OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Constructor } from '.';

export function DestroyableMixin<T extends Constructor<{}>>(Base: T) {
  return class extends Base implements OnDestroy {
    private readonly subscriptions: Subscription[] = [];

    protected registerSubscription(sub: Subscription) {
      this.subscriptions.push(sub);
    }

    ngOnDestroy() {
      this.subscriptions.forEach(x => x.unsubscribe());
    }
  };
}
