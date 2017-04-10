// This ID is reserved for the active path layer's parent group layer
// (i.e. if the user adds a rotation to the path morphing animation).
export const ROTATION_GROUP_LAYER_ID = 'rotation_group';

export function getUniqueId(prefix = '', objectById = (_) => undefined, targetObject?) {
  let n = 0;
  const idFn = () => prefix + (n ? `_${n}` : '');
  while (true) {
    const o = objectById(idFn());
    if (!o || o === targetObject) {
      break;
    }
    n++;
  }
  return idFn();
}
