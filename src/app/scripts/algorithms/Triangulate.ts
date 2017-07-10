import earcut from 'earcut';

import { collapseTopology, createTopology } from './Topology';
import { Ring } from './Types';

export function triangulate(ring: Ring, numPieces: number) {
  return collapseTopology(createTopology(cut(ring), ring), numPieces);
}

function cut(ring: Ring) {
  const vertices = ring.reduce(function(arr, point) {
    return arr.concat(point.slice(0, 2));
  }, []);
  const cuts = earcut(vertices);
  const triangles = [];
  for (let i = 0, l = cuts.length; i < l; i += 3) {
    // Save each triangle as segments [a, b], [b, c], [c, a]
    triangles.push([[cuts[i], cuts[i + 1]], [cuts[i + 1], cuts[i + 2]], [cuts[i + 2], cuts[i]]]);
  }
  return triangles;
}
