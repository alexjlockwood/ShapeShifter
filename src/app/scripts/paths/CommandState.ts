import * as _ from 'lodash';
import { MathUtil, Point, Matrix } from '../common';
import { Calculator, newCalculator, Line } from './calculators';
import { SvgChar, Command, ProjectionResult } from '.';

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
    private readonly mutations: ReadonlyArray<Mutation> = [{
      id: backingCommand.getId(),
      t: 1,
      svgChar: backingCommand.getSvgChar(),
    }],
    // The transformation matricies used to transform this command state object.
    private readonly transforms: ReadonlyArray<Matrix> = [new Matrix()],
    // The calculator that will do all of the math-y stuff for us.
    private readonly calculator: Calculator = newCalculator(backingCommand),
    // The lower bound T value (may be > 0 for split subpaths).
    private readonly minT = 0,
    // The upper bound T value (may be < 1 for split subpaths).
    private readonly maxT = 1,
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
    const splitIdx = _.sum(this.mutations.map(m => m.t < projectionResult.t ? 1 : 0));
    const tempSplits = [this.minT, ...this.mutations.map(m => m.t)];
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

  fork(splitIdx: number) {
    const left = this.mutate().sliceLeft(splitIdx).build();
    let right = undefined;
    if (this.isSplitAtIndex(splitIdx)) {
      right = this.mutate().sliceRight(splitIdx).build();
    }
    return { left, right };
  }

  /**
   * Returns true iff the command at the specified index is split.
   */
  isSplitAtIndex(splitIdx: number) {
    return splitIdx !== this.mutations.length - 1;
  }

  mutate() {
    return new CommandStateMutator(
      this.backingCommand,
      this.mutations.slice(),
      this.transforms.slice(),
      this.calculator,
      this.minT,
      this.maxT,
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
    private transforms: Matrix[],
    private calculator: Calculator,
    private minT: number,
    private maxT: number,
  ) { }

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

  /**
   * Reverses the information stored by this command state object.
   */
  reverse() {
    this.backingCommand = this.backingCommand.mutate().reverse().build();
    this.calculator = newCalculator(this.backingCommand);
    const lastMutation = this.mutations.pop();
    this.mutations = this.mutations.map(m => {
      const { id, svgChar } = m;
      return { id, svgChar, t: MathUtil.lerp(this.maxT, this.minT, m.t) };
    }).reverse();
    this.mutations.push(lastMutation);
    return this;
  }

  /**
   * Inserts the provided t values at the specified split index. The t values
   * are linearly interpolated between the split values at splitIdx and
   * splitIdx + 1 to ensure the split is done in relation to the mutated command.
   */
  splitAtIndex(splitIdx: number, ts: number[]) {
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
      console.warn('Attempt to unsplit a non-split command');
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
  addTransforms(transforms: Matrix[]) {
    return this.setTransforms([].concat(transforms, this.transforms));
  }

  /**
   * Sets transforms to this command state object using the
   * specified transformation matrices.
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
   * Reverts this command state object back to its original state.
   */
  revert() {
    this.mutations = [{
      id: _.last(this.mutations).id,
      t: _.last(this.mutations).t,
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
    let prevT = this.minT;
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
    return new CommandState(
      this.backingCommand,
      builtCommands,
      this.mutations,
      this.transforms,
      this.calculator,
      this.minT,
      this.maxT,
    );
  }
}
