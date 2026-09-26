/**
 * Solves the assignment problem with the Hungarian algorithm: given the cost of pairing each row
 * with each column, where there are no more rows than columns, pairs every row with a different
 * column so that the total cost is as small as possible. Returns the column paired with each row.
 * Runs in O(rows² × columns) time.
 */
export function assign(costs: ReadonlyArray<ReadonlyArray<number>>): number[] {
  const numRows = costs.length;
  if (!numRows) {
    return [];
  }
  const numCols = costs[0].length;
  if (costs.some(row => row.length !== numCols) || numRows > numCols) {
    throw new Error('Expected at least as many columns as rows, in every row');
  }
  if (!costs.every(row => row.every(Number.isFinite))) {
    // The search below would never end.
    throw new Error('Expected every cost to be a finite number');
  }

  // The rows and columns are indexed from 1 here, and column 0 is a placeholder that the rows
  // start from. rowPotentials and colPotentials are the dual variables, and rowForCol holds the
  // row paired with each column (0 if none).
  const rowPotentials = new Array<number>(numRows + 1).fill(0);
  const colPotentials = new Array<number>(numCols + 1).fill(0);
  const rowForCol = new Array<number>(numCols + 1).fill(0);
  const prevCol = new Array<number>(numCols + 1).fill(0);

  for (let row = 1; row <= numRows; row++) {
    rowForCol[0] = row;
    let col = 0;
    const minSlack = new Array<number>(numCols + 1).fill(Infinity);
    const isVisited = new Array<boolean>(numCols + 1).fill(false);
    // Grow a tree of tight edges from the new row until it reaches a free column.
    do {
      isVisited[col] = true;
      const visitedRow = rowForCol[col];
      let delta = Infinity;
      let nextCol = 0;
      for (let c = 1; c <= numCols; c++) {
        if (isVisited[c]) {
          continue;
        }
        const slack = costs[visitedRow - 1][c - 1] - rowPotentials[visitedRow] - colPotentials[c];
        if (slack < minSlack[c]) {
          minSlack[c] = slack;
          prevCol[c] = col;
        }
        if (minSlack[c] < delta) {
          delta = minSlack[c];
          nextCol = c;
        }
      }
      for (let c = 0; c <= numCols; c++) {
        if (isVisited[c]) {
          rowPotentials[rowForCol[c]] += delta;
          colPotentials[c] -= delta;
        } else {
          minSlack[c] -= delta;
        }
      }
      col = nextCol;
    } while (rowForCol[col]);
    // Flip the pairs along the path back to the new row.
    do {
      const c = prevCol[col];
      rowForCol[col] = rowForCol[c];
      col = c;
    } while (col);
  }

  const colForRow = new Array<number>(numRows).fill(-1);
  for (let col = 1; col <= numCols; col++) {
    if (rowForCol[col]) {
      colForRow[rowForCol[col] - 1] = col - 1;
    }
  }
  return colForRow;
}
