import { DrawCommand } from '../model';

const MATCH = 1;
const MISMATCH = -1;
const INDEL = 0;

/** Represents either a valid draw command or an empty placeholder slot. */
export interface Alignment {
  drawCommand?: DrawCommand;
}

/** Aligns two sequences of draw commands using the Needleman-Wunsch algorithm. */
export function align(from: DrawCommand[], to: DrawCommand[]) {
  const listA: Alignment[] = from.map(drawCommand => { return { drawCommand }; });
  const listB: Alignment[] = to.map(drawCommand => { return { drawCommand }; });
  const originalListA = from;
  const originalListB = to;
  const alignedListA: Alignment[] = [];
  const alignedListB: Alignment[] = [];

  // Add dummy nodes at the first position of each list.
  listA.unshift(undefined);
  listB.unshift(undefined);

  // Initialize the scoring matrix.
  const matrix: number[][] = [];
  for (let i = 0; i < listA.length; i++) {
    const row = [];
    for (let j = 0; j < listB.length; j++) {
      row.push(i === 0 ? -j : j === 0 ? -i : 0);
    }
    matrix.push(row);
  }

  const getScoreFn = (i: number, j: number) => {
    if (i < 1 || j < 1) {
      throw new Error(`Invalid indices: (${i},${j})`);
    }
    const cmdA = listA[i].drawCommand;
    const cmdB = listB[j].drawCommand;
    return cmdA.svgChar === cmdB.svgChar ? MATCH : MISMATCH;
  };

  // Process the scoring matrix.
  for (let i = 1; i < listA.length; i++) {
    for (let j = 1; j < listB.length; j++) {
      const match = matrix[i - 1][j - 1] + getScoreFn(i, j);
      const ins = matrix[i][j - 1] + INDEL;
      const del = matrix[i - 1][j] + INDEL;
      matrix[i][j] = Math.max(match, ins, del);
    }
  }

  // Backtracking.
  let i = listA.length - 1;
  let j = listB.length - 1;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && matrix[i][j] === matrix[i - 1][j - 1] + getScoreFn(i, j)) {
      alignedListA.unshift(listA[i--]);
      alignedListB.unshift(listB[j--]);
    } else if (i > 0 && matrix[i][j] === matrix[i - 1][j] + INDEL) {
      alignedListA.unshift(listA[i--]);
      alignedListB.unshift({});
    } else {
      alignedListA.unshift({});
      alignedListB.unshift(listB[j--]);
    }
  }

  return { from: alignedListA, to: alignedListB };
}
