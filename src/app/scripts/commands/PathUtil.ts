/**
 * Sorts a list of path ops in descending order.
 */
export function sortPathOps(ops: Array<{ subIdx: number, cmdIdx: number }>) {
  return ops.sort(
    ({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
      // Perform higher index splits first so that we don't alter the
      // indices of the lower index split operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });;
}
