import * as _ from 'lodash';
import { MathUtil, Point, Matrix } from '../common';
import { Calculator, newCalculator, Line } from './calculators';
import { SvgChar, Command, ProjectionResult } from '.';

/**
 * Contains additional information about each individual command so that we can
 * remember how they should be projected onto and split/unsplit/converted at runtime.
 * Paths are immutable, stateless objects that depend on this class to
 * remember their mutations. CommandMutations themselves are also immutable to ensure
 * that each Path maintains its own unique snapshot of its current mutation state.
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
    // are always reversible.
    private readonly mutations: ReadonlyArray<Mutation> = [{
      id: backingCommand.getId(),
      t: 1,
      svgChar: backingCommand.getSvgChar(),
    }],
    // The transformation matricies used to transform this command state object.
    private readonly transforms: ReadonlyArray<Matrix> = [new Matrix()],
    // The calculator that will do all of the math-y stuff for us.
    private readonly calculator: Calculator = newCalculator(backingCommand),
  ) { }

  getCommands() {
    return this.commands;
  }

  getBoundingBox() {
    return this.calculator.getBoundingBox();
  }

  intersects(line: Line) {
    return this.calculator.intersects(line);
  }

  getIdAtIndex(splitIdx: number) {
    return this.mutations[splitIdx].id;
  }

  getPathLength() {
    return this.calculator.getPathLength();
  }

  project(point: Point): { projectionResult: ProjectionResult, splitIdx: number } | undefined {
    const projectionResult = this.calculator.project(point);
    if (!projectionResult) {
      return undefined;
    }
    // Count the number of t values that are less than the projection.
    const splitIdx =
      _.chain(this.mutations)
        .map((mutation: Mutation) => mutation.t < projectionResult.t ? 1 : 0)
        .sum()
        .value();
    const tempSplits = [0, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    // Update the t value so that it is in relation to the client-visible subIdx and cmdIdx.
    projectionResult.t =
      startSplit === endSplit ? 0 : (projectionResult.t - startSplit) / (endSplit - startSplit);
    return {
      projectionResult,
      splitIdx,
    };
  }

  mutate() {
    return new CommandStateMutator(
      this.backingCommand,
      this.mutations.slice(),
      this.transforms.slice(),
      this.calculator,
    );
  }
}

export interface Mutation {
  readonly id: string;
  readonly t: number;
  readonly svgChar: SvgChar;
}

interface ConstructorParams {
  readonly backingCommand: Command;
  readonly mutations: ReadonlyArray<Mutation>;
  readonly transforms: ReadonlyArray<Matrix>;
  readonly commands: ReadonlyArray<Command>;
  readonly calculator: Calculator;
}

/**
 * A builder class for creating new mutated CommandState objects.
 */
class CommandStateMutator {

  constructor(
    private readonly backingCommand: Command,
    private mutations: Mutation[],
    private transforms: Matrix[],
    private calculator: Calculator,
  ) { }

  /**
   * Inserts the provided t values at the specified split index. The t values
   * are linearly interpolated between the split values at splitIdx and
   * splitIdx + 1 to ensure the split is done in relation to the mutated command.
   */
  splitAtIndex(splitIdx: number, ts: number[]) {
    const tempSplits = [0, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    return this.split(ts.map(t => MathUtil.lerp(startSplit, endSplit, t)));
  }

  /**
   * Same as splitAtIndex() except the command is split into two approximately
   * equal parts.
   */
  splitInHalfAtIndex(splitIdx: number) {
    const tempSplits = [0, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    const distance = MathUtil.lerp(startSplit, endSplit, 0.5);
    return this.split([this.calculator.findTimeByDistance(distance)]);
  }

  private split(ts: number[]) {
    if (!ts.length || this.backingCommand.getSvgChar() === 'M') {
      return this;
    }
    const currSplits = this.mutations.map(m => m.t);
    const currSvgChars = this.mutations.map(m => m.svgChar);
    for (const t of ts) {
      const id = _.uniqueId();
      const svgChar = currSvgChars[_.sortedIndex(currSplits, t)];
      const mutation = { id, t, svgChar };
      const insertionIdx =
        _.sortedIndexBy<Mutation>(this.mutations, mutation, m => m.t);
      this.mutations.splice(insertionIdx, 0, { id, t, svgChar });
    }
    for (let i = 0; i < this.mutations.length - 1; i++) {
      const mutation = this.mutations[i];
      if (mutation.svgChar === 'Z') {
        // Force convert the split closepath command into a line.
        this.mutations[i] = _.assign({}, mutation, { svgChar: 'L' });
      }
    }
    return this;
  }

  /**
   * Unsplits the command at the specified split index.
   */
  unsplitAtIndex(splitIdx: number) {
    this.mutations.splice(splitIdx, 1);
    return this;
  }

  /**
   * Converts the command at the specified split index.
   */
  convertAtIndex(splitIdx: number, svgChar: SvgChar) {
    this.mutations[splitIdx] = _.assign({}, this.mutations[splitIdx], { svgChar });
    return this;
  }

  /**
   * Unconverts all conversions previously performed on this command mutation.
   */
  unconvertSubpath() {
    const backingSvgChar = this.backingCommand.getSvgChar();
    this.mutations = this.mutations.map((mutation, i) => {
      let svgChar = backingSvgChar;
      if (backingSvgChar === 'Z' && i !== this.mutations.length - 1) {
        // Force convert the split closepath command back into a line.
        svgChar = 'L';
      }
      return _.assign({}, mutation, { svgChar });
    });
    return this;
  }

  /**
   * Adds transforms to this command mutation using the specified transformation matrices.
   */
  addTransforms(transforms: Matrix[]) {
    return this.setTransforms([].concat(transforms, this.transforms));
  }

  /**
   * Sets transforms to this command mutation using the specified transformation matrices.
   */
  setTransforms(transforms: Matrix[]) {
    this.transforms = [Matrix.flatten(...transforms)];
    this.calculator =
      newCalculator(
        this.backingCommand.mutate()
          .transform(this.transforms)
          .build());
    return this;
  }

  /**
   * Reverts this command mutation back to its original state.
   */
  revert() {
    this.mutations = [{
      id: _.last(this.mutations).id,
      t: 1,
      svgChar: this.backingCommand.getSvgChar(),
    }];
    this.transforms = [new Matrix()];
    this.calculator = newCalculator(this.backingCommand);
    return this;
  }

  /**
   * Builds a new command state object.
   */
  build() {
    // TODO: this could be more efficient (avoid recreating commands unnecessarily)
    const builtCommands: Command[] = [];
    if (this.mutations.length === 1) {
      builtCommands.push(
        this.calculator
          .convert(this.mutations[0].svgChar)
          .toCommand()
          .mutate()
          .setId(this.mutations[0].id)
          .build());
    } else {
      let prevT = 0;
      for (let i = 0; i < this.mutations.length; i++) {
        const currT = this.mutations[i].t;
        const commandBuilder =
          this.calculator
            .split(prevT, currT)
            .convert(this.mutations[i].svgChar)
            .toCommand()
            .mutate()
            .setId(this.mutations[i].id);
        if (i !== this.mutations.length - 1) {
          commandBuilder.toggleSplit();
        }
        builtCommands.push(commandBuilder.build());
        prevT = currT;
      }
    }
    return new CommandState(
      this.backingCommand,
      builtCommands,
      this.mutations,
      this.transforms,
      this.calculator,
    );
  }
}
