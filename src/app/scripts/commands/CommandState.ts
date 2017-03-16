import * as _ from 'lodash';
import { MathUtil, Point, Matrix } from '../common';
import { Calculator, newCalculator, BBox, Line } from './calculators';
import { SvgChar, ProjectionResult } from '.';
import { CommandImpl } from './CommandImpl';

const IDENTITY = new Matrix();

/**
 * Contains additional information about each individual command so that we can
 * remember how they should be projected onto and split/unsplit/converted at runtime.
 * Paths are immutable, stateless objects that depend on this class to
 * remember their mutations. CommandMutations themselves are also immutable to ensure
 * that each Path maintains its own unique snapshot of its current mutation state.
 */
export class CommandState {
  // The original un-mutated command.
  private readonly backingCommand: CommandImpl;

  // A lazily-initialized calculator that will do all of the math-y stuff for us.
  private calculator_: Calculator;

  // A command state object wraps around the initial SVG command and outputs
  // a list of transformed commands resulting from splits, unsplits,
  // conversions, etc. If the initial SVG command hasn't been modified,
  // then a list containing the initial SVG command is returned.
  private readonly commands: ReadonlyArray<CommandImpl>;

  // The list of mutations describes how the initial backing command
  // has since been modified. Since the command mutation always holds a
  // reference to its initial backing command, these modifications
  // are always reversible.
  private readonly mutations: ReadonlyArray<Mutation>;

  // The transformation matrix used to transform this command state object.
  private readonly transforms: ReadonlyArray<Matrix>;

  constructor(obj: CommandImpl | ConstructorParams) {
    if (obj instanceof CommandImpl) {
      this.backingCommand = obj;
      this.mutations = [{
        id: _.uniqueId(),
        t: 1,
        svgChar: this.backingCommand.svgChar,
      }];
      this.transforms = [IDENTITY];
      this.commands = [obj];
    } else {
      this.backingCommand = obj.backingCommand;
      this.mutations = obj.mutations;
      this.transforms = obj.transforms;
      this.commands = obj.commands;
      this.calculator_ = obj.calculator;
    }
  }

  private get calculator() {
    if (!this.calculator_) {
      this.calculator_ = newCalculator(this.backingCommand.transform(this.transforms));
    }
    return this.calculator_;
  }

  /**
   * Returns the transformed backing command's path length.
   */
  getPathLength() {
    return this.calculator.getPathLength();
  }

  /**
   * Note that the projection is performed in relation to the command mutation's
   * transformed backing command.
   */
  project(point: Point): { projectionResult: ProjectionResult, splitIdx: number } | undefined {
    const projectionResult = this.calculator.project(point);
    if (!projectionResult) {
      return undefined;
    }
    // Count the number of t values that are less than the projection.
    const splitIdx =
      _.chain(this.mutations)
        .map(mutation => mutation.t < projectionResult.t ? 1 : 0)
        .sum()
        .value();
    const tempSplits = [0, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    // Update the t value so that it is in relation to the client-visible subIdx and cmdIdx.
    projectionResult.t = MathUtil.lerp(startSplit, endSplit, projectionResult.t);
    return {
      projectionResult,
      splitIdx,
    };
  }

  /**
   * Note that the split is performed in relation to the command mutation's
   * transformed backing command.
   */
  split(ts: number[]) {
    return this.mutate().split(ts).build();
  }

  /**
   * Each command is given a globally unique ID (to improve performance
   * inside *ngFor loops, etc.).
   */
  getIdAtIndex(splitIdx: number) {
    return this.mutations[splitIdx].id;
  }

  /**
   * Inserts the provided t values at the specified split index. The t values
   * are linearly interpolated between the split values at splitIdx and
   * splitIdx + 1 to ensure the split is done in relation to the mutated command.
   */
  splitAtIndex(splitIdx: number, ts: number[]) {
    return this.mutate().splitAtIndex(splitIdx, ts).build();
  }

  /**
   * Same as splitAtIndex() except the command is split into two approximately
   * equal parts.
   */
  splitInHalfAtIndex(splitIdx: number) {
    return this.mutate().splitInHalfAtIndex(splitIdx).build();
  }

  /**
   * Unsplits the command at the specified split index.
   */
  unsplitAtIndex(splitIdx: number) {
    return this.mutate().unsplitAtIndex(splitIdx).build();
  }

  /**
   * Converts the command at the specified split index.
   */
  convertAtIndex(splitIdx: number, svgChar: SvgChar) {
    return this.mutate().convertAtIndex(splitIdx, svgChar).build();
  }

  /**
   * Unconverts all conversions previously performed on this command mutation.
   */
  unconvertSubpath() {
    return this.mutate().unconvertSubpath().build();
  }

  /**
   * Transforms this command mutation using the specified transformation matrices.
   */
  transform(transforms: Matrix[]) {
    return this.mutate().transform(transforms).build();
  }

  /**
   * Reverts this command mutation back to its original state.
   */
  revert() {
    return this.mutate().revert().build();
  }

  getCommands() {
    return this.commands;
  }

  getBoundingBox() {
    return this.calculator.getBoundingBox();
  }

  intersects(line: Line) {
    return this.calculator.intersects(line);
  }

  mutate() {
    return new CommandMutator(
      this.backingCommand,
      this.mutations.slice(),
      this.transforms.slice(),
      this.calculator,
    );
  }
}

interface Mutation {
  readonly id: string;
  readonly t: number;
  readonly svgChar: SvgChar;
}

interface ConstructorParams {
  readonly backingCommand: CommandImpl;
  readonly mutations: ReadonlyArray<Mutation>;
  readonly transforms: ReadonlyArray<Matrix>;
  readonly commands: ReadonlyArray<CommandImpl>;
  readonly calculator: Calculator;
}

class CommandMutator {

  constructor(
    private readonly backingCommand: CommandImpl,
    private mutations: Mutation[],
    private transforms: Matrix[],
    private calculator: Calculator,
  ) { }

  split(ts: number[]) {
    if (!ts.length || this.backingCommand.svgChar === 'M') {
      return this;
    }
    const currSplits = this.mutations.map(m => m.t);
    const currSvgChars = this.mutations.map(m => m.svgChar);
    const updatedMutations = this.mutations;
    for (const t of ts) {
      const id = _.uniqueId();
      const svgChar = currSvgChars[_.sortedIndex(currSplits, t)];
      const mutation = { id, t, svgChar };
      const insertionIdx =
        _.sortedIndexBy<Mutation>(updatedMutations, mutation, m => m.t);
      updatedMutations.splice(insertionIdx, 0, { id, t, svgChar });
    }
    for (let i = 0; i < updatedMutations.length - 1; i++) {
      const mutation = updatedMutations[i];
      if (mutation.svgChar === 'Z') {
        // Force convert the split closepath command into a line.
        updatedMutations[i] = _.assign({}, mutation, { svgChar: 'L' });
      }
    }
    return this;
  }

  splitAtIndex(splitIdx: number, ts: number[]) {
    const tempSplits = [0, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    return this.split(ts.map(t => MathUtil.lerp(startSplit, endSplit, t)));
  }

  splitInHalfAtIndex(splitIdx: number) {
    const tempSplits = [0, ...this.mutations.map(m => m.t)];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    const distance = MathUtil.lerp(startSplit, endSplit, 0.5);
    return this.split([this.calculator.findTimeByDistance(distance)]);
  }

  unsplitAtIndex(splitIdx: number) {
    this.mutations.splice(splitIdx, 1);
    return this;
  }

  convertAtIndex(splitIdx: number, svgChar: SvgChar) {
    this.mutations[splitIdx] = _.assign({}, this.mutations[splitIdx], { svgChar });
    return this;
  }

  unconvertSubpath() {
    const backingSvgChar = this.backingCommand.svgChar;
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

  transform(transforms: Matrix[]) {
    this.transforms = [].concat(transforms, this.transforms);
    this.calculator = newCalculator(this.backingCommand.transform(this.transforms));
    return this;
  }

  revert() {
    this.mutations = [{
      id: _.last(this.mutations).id,
      t: 1,
      svgChar: this.backingCommand.svgChar,
    }];
    this.transforms = [IDENTITY];
    this.calculator = newCalculator(this.backingCommand);
    return this;
  }

  build() {
    // Reset the calculator if the command has been transformed. The cloned CommandMutation
    // will lazily re-initialize the calculator when necessary.
    if (this.mutations.length === 1) {
      return new CommandState({
        backingCommand: this.backingCommand,
        mutations: this.mutations,
        transforms: this.transforms,
        commands: [this.calculator.convert(this.mutations[0].svgChar).toCommand()],
        calculator: this.calculator,
      });
    }
    // TODO: this could be more efficient (avoid recreating commands unnecessarily)
    const builtCommands: CommandImpl[] = [];
    let prevT = 0;
    for (let i = 0; i < this.mutations.length; i++) {
      const currT = this.mutations[i].t;
      let command =
        this.calculator
          .split(prevT, currT)
          .convert(this.mutations[i].svgChar)
          .toCommand();
      if (i !== this.mutations.length - 1) {
        command = command.toggleSplit();
      }
      builtCommands.push(command);
      prevT = currT;
    }
    return new CommandState({
      backingCommand: this.backingCommand,
      mutations: this.mutations,
      transforms: this.transforms,
      commands: builtCommands,
      calculator: this.calculator,
    });
  }
}
