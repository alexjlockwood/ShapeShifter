import * as _ from 'lodash';
import { MathUtil, Point, Matrix } from '../../common';
import { Calculator, newCalculator, BBox, Line } from '../calculators';
import { SvgChar, ProjectionResult } from '..';
import { CommandImpl } from '../CommandImpl';
import { CommandState, Mutation } from './CommandState';

/**
 * A builder class for creating new mutated CommandState objects.
 */
export class CommandStateMutator {

  constructor(
    private readonly backingCommand: CommandImpl,
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
    this.calculator = newCalculator(this.backingCommand.transform(this.transforms));
    return this;
  }

  /**
   * Reverts this command mutation back to its original state.
   */
  revert() {
    this.mutations = [{
      id: _.last(this.mutations).id,
      t: 1,
      svgChar: this.backingCommand.svgChar,
    }];
    this.transforms = [new Matrix()];
    this.calculator = newCalculator(this.backingCommand);
    return this;
  }

  /**
   * Builds a new command state object.
   */
  build() {
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
