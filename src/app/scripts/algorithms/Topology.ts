import { bisector } from 'd3-array';
import { polygonArea } from 'd3-polygon';
import { feature, mergeArcs, neighbors } from 'topojson-client';

import { Ring, Triangle } from './Types';

// TODO use TopoJSON native instead?
export function createTopology(triangles: Triangle[], ring: Ring) {
  const arcIndices = {},
    topology = {
      type: 'Topology',
      objects: {
        triangles: {
          type: 'GeometryCollection',
          geometries: [],
        },
      },
      arcs: [],
    };

  triangles.forEach(triangle => {
    const geometry = [];

    triangle.forEach((arc, i) => {
      const slug = arc[0] < arc[1] ? arc.join(',') : arc[1] + ',' + arc[0],
        coordinates = arc.map(pointIndex => ring[pointIndex]);

      if (slug in arcIndices) {
        geometry.push(~arcIndices[slug]);
      } else {
        geometry.push((arcIndices[slug] = topology.arcs.length));
        topology.arcs.push(coordinates);
      }
    });

    topology.objects.triangles.geometries.push({
      type: 'Polygon',
      area: Math.abs(polygonArea(triangle.map(d => ring[d[0]]))),
      arcs: [geometry],
    });
  });

  // Sort smallest first
  // TODO sorted insertion?
  topology.objects.triangles.geometries.sort((a, b) => a.area - b.area);
  return topology;
}

export function collapseTopology(topology, numPieces: number) {
  const geometries = topology.objects.triangles.geometries;
  const bisect = bisector(d => d.area).left;

  while (geometries.length > numPieces) {
    mergeSmallestFeature();
  }

  if (numPieces > geometries.length) {
    throw new RangeError("Can't collapse topology into " + numPieces + ' pieces.');
  }

  return feature(topology, topology.objects.triangles).features.map(f => {
    f.geometry.coordinates[0].pop();
    return f.geometry.coordinates[0];
  });

  function mergeSmallestFeature() {
    const smallest = geometries[0],
      neighborIndex = neighbors(geometries)[0][0],
      neighbor = geometries[neighborIndex],
      merged = mergeArcs(topology, [smallest, neighbor]);

    // MultiPolygon -> Polygon
    merged.area = smallest.area + neighbor.area;
    merged.type = 'Polygon';
    merged.arcs = merged.arcs[0];

    // Delete smallest and its chosen neighbor
    geometries.splice(neighborIndex, 1);
    geometries.shift();

    // Add new merged shape in sorted order
    geometries.splice(bisect(geometries, merged.area), 0, merged);
  }
}
