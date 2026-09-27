import { Duration, SnackBarService } from './snackbar.service';

describe('SnackBarService', () => {
  it('dismisses the message and then calls its action', () => {
    const service = new SnackBarService();
    const calls: string[] = [];
    service.show('Imported 1 layer', 'Morph', Duration.Long, () => {
      calls.push(service.getSnackBar() ? 'showing' : 'dismissed');
    });
    const snackBar = service.getSnackBar();
    if (!snackBar) {
      throw new Error('The message is missing');
    }
    expect(snackBar.action).toBe('MORPH');

    service.clickAction(snackBar);
    expect(calls).toEqual(['dismissed']);
    expect(service.getSnackBar()).toBeUndefined();
  });

  it('keeps a message that the action shows', () => {
    const service = new SnackBarService();
    service.show('First', 'Next', Duration.Short, () => service.show('Second'));
    const snackBar = service.getSnackBar();
    if (!snackBar) {
      throw new Error('The message is missing');
    }
    service.clickAction(snackBar);
    expect(service.getSnackBar()?.message).toBe('Second');
  });

  it("doesn't dismiss a newer message when an older one's button is clicked", () => {
    const service = new SnackBarService();
    service.show('First', 'Dismiss');
    const first = service.getSnackBar();
    if (!first) {
      throw new Error('The message is missing');
    }
    service.show('Second');
    service.clickAction(first);
    expect(service.getSnackBar()?.message).toBe('Second');
  });
});
