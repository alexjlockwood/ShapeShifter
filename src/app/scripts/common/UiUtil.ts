// TODO: figure out why travis fails when JQuery is uncommented
export function waitForElementWidth($el/*: JQuery*/, timeout = 1000) {
  const start = Number(new Date());
  return new Promise<number>((resolve, reject) => {
    const tryResolveFn = () => {
      if (Number(new Date()) - start > timeout) {
        reject();
        return;
      }
      const width = $el.width();
      if (width) {
        resolve(width);
      } else {
        setTimeout(() => tryResolveFn(), 0);
      }
    };
    tryResolveFn();
  });
}
