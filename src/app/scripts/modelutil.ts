export function getUniqueId(opts) {
  opts = opts || {};
  opts.prefix = opts.prefix || '';
  opts.objectById = opts.objectById || (() => null);
  opts.targetObject = opts.targetObject || null;

  let n = 0;
  let id_ = () => opts.prefix + (n ? `_${n}` : '');
  while (true) {
    let o = opts.objectById(id_());
    if (!o || o === opts.targetObject) {
      break;
    }
    n++;
  }

  return id_();
}
