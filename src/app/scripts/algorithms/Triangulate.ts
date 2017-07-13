import { bisector } from 'd3-array';
import { polygonArea } from 'd3-polygon';
import earcut from 'earcut';
import { feature, mergeArcs, neighbors } from 'topojson-client';

import { Point, Ring, Triangle } from './Types';

export function triangulate(ring: Ring, numPieces: number) {
  return collapseTopology(createTopology(cut(ring), ring), numPieces);
}

function cut(ring: Ring) {
  const cuts: ReadonlyArray<number> = earcut(
    ring.reduce((arr, point) => [...arr, ...point], [] as number[]),
  );
  const triangles: Triangle[] = [];
  for (let i = 0; i < cuts.length; i += 3) {
    // Save each triangle as segments [a, b], [b, c], [c, a].
    triangles.push([[cuts[i], cuts[i + 1]], [cuts[i + 1], cuts[i + 2]], [cuts[i + 2], cuts[i]]]);
  }
  return triangles;
}

interface Geometry {
  readonly type: 'Polygon';
  readonly area: number;
  readonly arcs: [[number, number, number]];
}

interface Topology {
  readonly type: 'Topology';
  readonly objects: {
    readonly triangles: {
      readonly type: 'GeometryCollection';
      readonly geometries: Geometry[];
    };
  };
  readonly arcs: ReadonlyArray<[Point, Point]>;
}

// TODO use TopoJSON native instead?
function createTopology(triangles: Triangle[], ring: Ring) {
  const arcs: [Point, Point][] = [];
  const geometries: Geometry[] = [];
  const arcIndices: Dictionary<number> = {};

  triangles.forEach(triangle => {
    const geometry: number[] = [];

    triangle.forEach((p, i) => {
      const slug = p[0] < p[1] ? p.join(',') : p[1] + ',' + p[0];
      const coordinates = p.map(pointIndex => ring[pointIndex]) as [Point, Point];

      if (slug in arcIndices) {
        // tslint:disable: no-bitwise
        geometry.push(~arcIndices[slug]);
      } else {
        arcIndices[slug] = arcs.length;
        geometry.push(arcs.length);
        arcs.push(coordinates);
      }
    });

    geometries.push({
      type: 'Polygon',
      area: Math.abs(polygonArea(triangle.map(d => ring[d[0]]))),
      arcs: [geometry as [number, number, number]],
    });
  });

  // Sort smallest first
  // TODO: sorted insertion?
  geometries.sort((a, b) => a.area - b.area);
  return {
    type: 'Topology',
    objects: {
      triangles: {
        type: 'GeometryCollection',
        geometries,
      },
    },
    arcs,
  } as Topology;
}

function collapseTopology(topology: Topology, numPieces: number): Ring[] {
  const { geometries } = topology.objects.triangles;
  const bisect = bisector<{ area: number }, number>(d => d.area).left;

  while (geometries.length > numPieces) {
    const smallest = geometries[0];
    const neighborIndex: number = neighbors(geometries)[0][0];
    const neighbor = geometries[neighborIndex];
    const merged = mergeArcs(topology, [smallest, neighbor]);

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

  if (numPieces > geometries.length) {
    throw new RangeError("Can't collapse topology into " + numPieces + ' pieces.');
  }

  return feature(topology, topology.objects.triangles).features.map(f => {
    f.geometry.coordinates[0].pop();
    return f.geometry.coordinates[0];
  });
}
