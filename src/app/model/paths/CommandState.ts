import { MathUtil, Matrix, Point } from 'app/scripts/common';
import * as _ from 'lodash';

import { Command, Projection, SvgChar } from '.';
import { Calculator, Line, newCalculator } from './calculators';

/**
 * Container class that encapsulates a Command's underlying state.
 */
export class CommandState {
  constructor(
    // The original un-mutated command.
    private readonly backingCommand: Command,
    // A command state object wraps around the initial SVG command and outputs
    // a list of transformed commands resulting from splits, unsplits,
    // conversions, etc. If the initial SVG command hasn't been modified,
    // then a list containing the initial SVG command is returned.
    private readonly commands: ReadonlyArray<Command> = [backingCommand],
    // The list of mutations describes how the initial backing command
    // has since been modified. Since the command state always holds a
    // reference to its initial backing command, these modifications
    // can be reversed simply by removing mutations from the list.
    private readonly mutations: ReadonlyArray<Mutation> = [
      {
        id: backingCommand.getId(),
        t: 1,
        svgChar: backingCommand.getSvgChar(),
      },
    ],
    // The transformation matricies used to transform this command state object.
    private readonly transform: Matrix = Matrix.identity(),
    // The calculator that will do all of the math-y stuff for us.
    private readonly calculator: Calculator = newCalculator(backingCommand),
    // The lower bound T value (may be > 0 for split subpaths).
    private readonly minT = 0,
    // The upper bound T value (may be < 1 for split subpaths).
    private readonly maxT = 1,
    // When a filled subpath is split, we assign a 'split command id' to the two
    // lines that are created (so that during unsplit operations we can identify
    // which segments were added together).
    private readonly splitSegmentId = '',
    // The parent command state object (i.e. the one that created the new split segment).
    private readonly parentCommandState?: CommandState,
  ) {}

  getBackingId() {
    return this.backingCommand.getId();
  }

  getCommands() {
    return this.commands;
  }

  getBoundingBox() {
    return this.calculator.getBoundingBox();
  }

  intersects(line: Line) {
    return this.calculator.intersects(line).filter(t => this.minT < t && t <= this.maxT);
  }

  getIdAtIndex(splitIdx: number) {
    return this.mutations[splitIdx].id;
  }

  getPathLength() {
    return this.calculator.getPathLength();
  }

  getPointAtLength(distance: number) {
    return this.calculator.getPointAtLength(distance);
  }

  project(point: Point): { projection: Projection; splitIdx: number } | undefined {
    const projection = this.calculator.project(point);
    if (!projection) {
      return undefined;
    }
    const projT = projection.t;
    if (projT < this.minT || this.maxT < projT) {
      // If this happens, then the projection is being mapped to some other
      // split command segment.
      // TODO: recompute the projection so that it properly returned the correct value...
      // console.warn('Failed to compute projection for CommandState');
      return undefined;
    }
    // Count the number of t values that are less than the projection.
    const splitIdx = _.sumBy(this.mutations, m => (m.t < projection.t ? 1 : 0));
    const tempSplits = [this.minT, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    // Update the t value so that it is in relation to the client-visible subIdx and cmdIdx.
    projection.t =
      startSplit === endSplit ? 0 : (projection.t - startSplit) / (endSplit - startSplit);
    return { projection, splitIdx };
  }

  /**
   * Slices the command state object into two parts. Useful for subpath splitting.
   */
  slice(splitIdx: number) {
    const left = this.mutate()
      .sliceLeft(splitIdx)
      .build();
    let right: CommandState;
    if (this.isSplitAtIndex(splitIdx)) {
      right = this.mutate()
        .sliceRight(splitIdx)
        .build();
    }
    return { left, right };
  }

  /**
   * Merges two previously sliced command state objects into one.
   */
  merge(cs: CommandState) {
    if (this.getBackingId() !== cs.getBackingId()) {
      throw new Error('Attempt to merge command state objects with unequal backing IDs');
    }
    if (this.minT < cs.minT) {
      console.warn('Merging command states out of order', this, cs);
    }
    return this.mutate()
      .setMutations([...cs.mutations.slice(0, cs.mutations.length - 1), ...this.mutations])
      .setMinT(cs.minT)
      .build();
  }

  /**
   * Returns true iff the command at the specified index is split.
   */
  isSplitAtIndex(splitIdx: number) {
    return splitIdx !== this.mutations.length - 1;
  }

  getSplitSegmentId() {
    return this.splitSegmentId;
  }

  getParentCommandState() {
    return this.parentCommandState;
  }

  mutate() {
    return new CommandStateMutator(
      this.backingCommand,
      [...this.mutations],
      this.transform,
      this.calculator,
      this.minT,
      this.maxT,
      this.splitSegmentId,
      this.parentCommandState,
    );
  }
}

interface Mutation {
  readonly id: string;
  readonly t: number;
  readonly svgChar: SvgChar;
}

/**
 * A builder class for creating new mutated CommandState objects.
 */
class CommandStateMutator {
  constructor(
    private backingCommand: Command,
    private mutations: Mutation[],
    private matrix: Matrix,
    private calculator: Calculator,
    private minT: number,
    private maxT: number,
    private splitSegmentId: string,
    private parentCommandState: CommandState,
  ) {}

  /**
   * Slices this command state object at the specified index, discarding
   * anything to the right.
   */
  sliceLeft(splitIdx: number) {
    this.mutations = this.mutations.slice(0, splitIdx + 1).map(m => _.clone(m));
    this.maxT = _.last(this.mutations).t;
    return this;
  }

  /**
   * Slices this command state object at the specified index, discarding
   * anything to the left.
   */
  sliceRight(splitIdx: number) {
    this.minT = this.mutations[splitIdx].t;
    this.mutations = this.mutations.slice(splitIdx + 1).map(m => _.clone(m));
    return this;
  }

  setMutations(mutations: ReadonlyArray<Mutation>) {
    this.mutations = [...mutations];
    return this;
  }

  setMinT(minT: number) {
    this.minT = minT;
    return this;
  }

  /**
   * Sets this command state object as a split segment with a unique ID.
   * The parent state object represents the origin command state.
   */
  setSplitSegmentInfo(parentCommandState: CommandState, id: string) {
    this.splitSegmentId = id;
    this.parentCommandState = parentCommandState;
    return this;
  }

  /**
   * Reverses the information stored by this command state object.
   */
  reverse() {
    this.backingCommand = this.backingCommand
      .mutate()
      .reverse()
      .build();
    this.calculator = newCalculator(this.backingCommand);
    const lastMutation = this.mutations.pop();
    this.mutations = this.mutations
      .map(m => {
        const { id, svgChar } = m;
        return { id, svgChar, t: MathUtil.lerp(this.maxT, this.minT, m.t) };
      })
      .reverse();
    this.mutations.push(lastMutation);
    return this;
  }

  /**
   * Inserts the provided t values at the specified split index. The t values
   * are linearly interpolated between the split values at splitIdx and
   * splitIdx + 1 to ensure the split is done in relation to the mutated command.
   */
  splitAtIndex(splitIdx: number, ts: ReadonlyArray<number>) {
    const tempSplits = [this.minT, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    return this.split(ts.map(t => MathUtil.lerp(startSplit, endSplit, t)));
  }

  /**
   * Same as splitAtIndex() except the command is split into two approximately
   * equal parts.
   */
  splitInHalfAtIndex(splitIdx: number) {
    const tempSplits = [this.minT, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    const distance = MathUtil.lerp(startSplit, endSplit, 0.5);
    return this.split([this.calculator.findTimeByDistance(distance)]);
  }

  private split(ts: ReadonlyArray<number>) {
    if (!ts.length || this.backingCommand.getSvgChar() === 'M') {
      return this;
    }
    const currSplits = this.mutations.map(m => m.t);
    const currSvgChars = this.mutations.map(m => m.svgChar);
    for (const t of ts) {
      const id = _.uniqueId();
      const svgChar = currSvgChars[_.sortedIndex(currSplits, t)];
      const mutation = { id, t, svgChar };
      const insertionIdx = _.sortedIndexBy<Mutation>(this.mutations, mutation, m => m.t);
      this.mutations.splice(insertionIdx, 0, { id, t, svgChar });
    }
    for (let i = 0; i < this.mutations.length - 1; i++) {
      const mutation = this.mutations[i];
      if (mutation.svgChar === 'Z') {
        // Force convert the split closepath command into a line.
        const { id, t } = mutation;
        this.mutations[i] = { id, t, svgChar: 'L' };
      }
    }
    return this;
  }

  /**
   * Unsplits the command at the specified split index.
   */
  unsplitAtIndex(splitIdx: number) {
    if (!this.isSplitAtIndex(splitIdx)) {
      console.warn('Ignoring attempt to unsplit a non-split command', this);
      return this;
    }
    this.mutations.splice(splitIdx, 1);
    return this;
  }

  /**
   * Returns true iff the command at the specified index is split.
   */
  private isSplitAtIndex(splitIdx: number) {
    return splitIdx !== this.mutations.length - 1;
  }

  /**
   * Converts the command at the specified split index.
   */
  convertAtIndex(splitIdx: number, svgChar: SvgChar) {
    const { id, t } = this.mutations[splitIdx];
    this.mutations[splitIdx] = { id, t, svgChar };
    return this;
  }

  /**
   * Unconverts all conversions previously performed on this
   * command state object.
   */
  unconvertSubpath() {
    const backingSvgChar = this.backingCommand.getSvgChar();
    this.mutations = this.mutations.map((mutation, i) => {
      let svgChar = backingSvgChar;
      if (backingSvgChar === 'Z' && i !== this.mutations.length - 1) {
        // Force convert the split closepath command back into a line.
        svgChar = 'L';
      }
      const { id, t } = mutation;
      return { id, t, svgChar };
    });
    return this;
  }

  /**
   * Converts closepath commands to lines. This method irreversibly builds
   * a new backing command to use.
   */
  forceConvertClosepathsToLines() {
    if (this.backingCommand.getSvgChar() === 'Z') {
      this.backingCommand = this.calculator.convert('L').toCommand();
      this.calculator = newCalculator(this.backingCommand);
      this.mutations = this.mutations.map(m => {
        const { id, t, svgChar } = m;
        const newSvgChar = svgChar === 'Z' ? 'L' : svgChar;
        return { id, t, svgChar: newSvgChar };
      });
    }
    return this;
  }

  /**
   * Adds transforms to this command state object using the
   * specified transformation matrices.
   */
  transform(transform: Matrix) {
    this.matrix = transform.dot(this.matrix);
    this.calculator = newCalculator(
      this.backingCommand
        .mutate()
        .transform(this.matrix)
        .build(),
    );
    return this;
  }

  /**
   * Reverts this command state object back to its original state.
   */
  revert() {
    this.mutations = [
      {
        id: _.last(this.mutations).id,
        t: _.last(this.mutations).t,
        svgChar: this.backingCommand.getSvgChar(),
      },
    ];
    this.matrix = Matrix.identity();
    this.calculator = newCalculator(this.backingCommand);
    return this;
  }

  /**
   * Builds a new command state object.
   */
  build() {
    // TODO: this could be more efficient (avoid recreating commands unnecessarily)
    const builtCommands: Command[] = [];
    let prevT = this.minT;
    for (let i = 0; i < this.mutations.length; i++) {
      const currT = this.mutations[i].t;
      const isSplitSegment = this.mutations[i].svgChar !== 'M' && !!this.parentCommandState;
      builtCommands.push(
        this.calculator
          .split(prevT, currT)
          .convert(this.mutations[i].svgChar)
          .toCommand()
          .mutate()
          .setId(this.mutations[i].id)
          .setIsSplitPoint(i !== this.mutations.length - 1)
          .setIsSplitSegment(isSplitSegment)
          .build(),
      );
      prevT = currT;
    }
    return new CommandState(
      this.backingCommand,
      builtCommands,
      this.mutations,
      this.matrix,
      this.calculator,
      this.minT,
      this.maxT,
      this.splitSegmentId,
      this.parentCommandState,
    );
  }
}
