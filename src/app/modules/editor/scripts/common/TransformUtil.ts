// TODO: change argument types to a Quadrilateral
export function distort(sourcePoints: [number, number][], targetPoints: [number, number][]) {
  const a = [];
  const b = [];
  for (let i = 0, n = sourcePoints.length; i < n; ++i) {
    const s = sourcePoints[i];
    const t = targetPoints[i];
    a.push([s[0], s[1], 1, 0, 0, 0, -s[0] * t[0], -s[1] * t[0]]), b.push(t[0]);
    a.push([0, 0, 0, s[0], s[1], 1, -s[0] * t[1], -s[1] * t[1]]), b.push(t[1]);
  }

  const X = solve(a, b, true);

  // prettier-ignore
  const matrix = [
      X[0], X[3], 0, X[6],
      X[1], X[4], 0, X[7],
         0,    0, 1,    0,
      X[2], X[5], 0,    1,
    ].map((x) => Math.round(x * 10e6) / 10e6);

  // Given a 4x4 perspective transformation matrix, and a 2D point (a 2x1 vector),
  // applies the transformation matrix by converting the point to homogeneous
  // coordinates at z=0, post-multiplying, and then applying a perspective divide.
  return (point: [number, number]) => {
    const pt = multiply(matrix, [point[0], point[1], 0, 1]);
    return [pt[0] / pt[3], pt[1] / pt[3]];
  };

  // Post-multiply a 4x4 matrix in column-major order by a 4x1 column vector:
  // [ m0 m4 m8  m12 ]   [ v0 ]   [ x ]
  // [ m1 m5 m9  m13 ] * [ v1 ] = [ y ]
  // [ m2 m6 m10 m14 ]   [ v2 ]   [ z ]
  // [ m3 m7 m11 m15 ]   [ v3 ]   [ w ]
  function multiply(m: number[], v: [number, number, number, number]) {
    // prettier-ignore
    return [
    m[0] * v[0] + m[4] * v[1] + m[8 ] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9 ] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
  }
}

/* Code below is copied from numeric.js */

const abs = Math.abs;

function _foreach2(x: any, s: any, k: any, f: any) {
  if (k === s.length - 1) {
    return f(x);
  }
  let i;
  const n = s[k];
  const ret = Array(n);
  for (i = n - 1; i >= 0; --i) {
    ret[i] = _foreach2(x[i], s, k + 1, f);
  }
  return ret;
}

function _dim(x: any) {
  const ret = [];
  while (typeof x === 'object') {
    ret.push(x.length), (x = x[0]);
  }
  return ret;
}

function dim(x: any) {
  let y, z;
  if (typeof x === 'object') {
    y = x[0];
    if (typeof y === 'object') {
      z = y[0];
      if (typeof z === 'object') {
        return _dim(x);
      }
      return [x.length, y.length];
    }
    return [x.length];
  }
  return [];
}

function cloneV(x: any) {
  const _n = x.length;
  let i;
  const ret = Array(_n);
  for (i = _n - 1; i !== -1; --i) {
    ret[i] = x[i];
  }
  return ret;
}

function clone(x: any) {
  return typeof x !== 'object' ? x : _foreach2(x, dim(x), 0, cloneV);
}

function LU(A: any, fast: any) {
  fast = fast || false;

  let i, j, k, absAjk, Akk, Ak, Pk, Ai, max;
  const n = A.length;
  const n1 = n - 1;
  const P = new Array(n);

  if (!fast) {
    A = clone(A);
  }

  for (k = 0; k < n; ++k) {
    Pk = k;
    Ak = A[k];
    max = abs(Ak[k]);
    for (j = k + 1; j < n; ++j) {
      absAjk = abs(A[j][k]);
      if (max < absAjk) {
        max = absAjk;
        Pk = j;
      }
    }
    P[k] = Pk;

    if (Pk !== k) {
      A[k] = A[Pk];
      A[Pk] = Ak;
      Ak = A[k];
    }

    Akk = Ak[k];

    for (i = k + 1; i < n; ++i) {
      A[i][k] /= Akk;
    }

    for (i = k + 1; i < n; ++i) {
      Ai = A[i];
      for (j = k + 1; j < n1; ++j) {
        Ai[j] -= Ai[k] * Ak[j];
        ++j;
        Ai[j] -= Ai[k] * Ak[j];
      }
      if (j === n1) {
        Ai[j] -= Ai[k] * Ak[j];
      }
    }
  }

  return {
    LU: A,
    P: P,
  };
}

function LUsolve(LUP: any, b: any) {
  let i;
  let j;
  const lu = LUP.LU;
  const n = lu.length;
  const x = clone(b);
  const P = LUP.P;
  let Pi;
  let LUi;
  let tmp;

  for (i = n - 1; i !== -1; --i) {
    x[i] = b[i];
  }
  for (i = 0; i < n; ++i) {
    Pi = P[i];
    if (P[i] !== i) {
      (tmp = x[i]), (x[i] = x[Pi]), (x[Pi] = tmp);
    }
    LUi = lu[i];
    for (j = 0; j < i; ++j) {
      x[i] -= x[j] * LUi[j];
    }
  }

  for (i = n - 1; i >= 0; --i) {
    LUi = lu[i];
    for (j = i + 1; j < n; ++j) {
      x[i] -= x[j] * LUi[j];
    }
    x[i] /= LUi[i];
  }

  return x;
}

function solve(A: any, b: any, fast: any) {
  return LUsolve(LU(A, fast), b);
}
