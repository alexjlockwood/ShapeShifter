export function waitForElementWidth($el: JQuery, timeout = 1000) {
  const start = Number(new Date());
  return new Promise<number>((resolve, reject) => {
    const tryResolve_ = () => {
      if (Number(new Date()) - start > timeout) {
        reject();
        return;
      }
      const width = $el.width();
      if (width) {
        resolve(width);
      } else {
        setTimeout(() => tryResolve_(), 0);
      }
    };
    tryResolve_();
  });
}
