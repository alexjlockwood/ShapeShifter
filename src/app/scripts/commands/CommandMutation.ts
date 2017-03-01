import * as _ from 'lodash';
import { MathUtil, Point } from '../common';
import { Mutator, newMutator } from './mutators';
import { SvgChar, Projection } from '.';
import { CommandImpl } from './CommandImpl';
import { newLine } from '../commands';

/**
 * Contains additional information about each individual command so that we can
 * remember how they should be projected onto and split/unsplit/converted at runtime.
 * Paths are immutable, stateless objects that depend on this class to
 * remember their mutations. CommandMutations themselves are also immutable to ensure that
 * each Path maintains its own unique snapshot of its current mutation state.
 */
export class CommandMutation {
  readonly backingCommand: CommandImpl;

  // Note that the mutator is currently undefined for move commands.
  private readonly mutator: Mutator;

  // A command mutation wraps around the initial SVG command and outputs
  // a list of transformed commands resulting from splits, unsplits,
  // conversions, etc. If the initial SVG command hasn't been modified,
  // then a list containing the initial SVG command is returned.
  private readonly builtCommands: ReadonlyArray<CommandImpl>;

  // The list of mutations describes how the initial backing command
  // has since been modified. Since the command mutation always holds a
  // reference to its initial backing command, these modifications
  // are always reversible.
  private readonly mutations: ReadonlyArray<Mutation>;

  constructor(obj: CommandImpl | ConstructorParams) {
    if (obj instanceof CommandImpl) {
      this.backingCommand = obj;
      this.mutations = [{
        id: _.uniqueId(),
        t: 1,
        svgChar: this.backingCommand.svgChar,
      }];
      this.builtCommands = [obj];
      this.mutator = newMutator(this.backingCommand);
    } else {
      this.backingCommand = obj.backingCommand;
      this.mutations = obj.mutations;
      this.builtCommands = obj.builtCommands;
      this.mutator = obj.mutator;
    }
  }

  getPathLength() {
    const isMove = this.backingCommand.svgChar === 'M';
    return isMove ? 0 : this.mutator.getPathLength();
  }

  /**
   * Note that the projection is performed in relation to the command mutation's
   * original backing command.
   */
  project(point: Point): Projection | undefined {
    const isMove = this.backingCommand.svgChar === 'M';
    return isMove ? undefined : this.mutator.project(point);
  }

  /**
   * Note that the split is performed in relation to the command mutation's
   * original backing command.
   */
  split(ts: number[]) {
    if (!ts.length || this.backingCommand.svgChar === 'M') {
      return this;
    }
    const currSplits = this.mutations.map(m => m.t);
    const currSvgChars = this.mutations.map(m => m.svgChar);
    const updatedMutations = this.mutations.slice();
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
    return this.rebuildCommands(updatedMutations);
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
    return this.split([this.mutator.findTimeByDistance(distance)]);
  }

  /**
   * Unsplits the command at the specified split index.
   */
  unsplitAtIndex(splitIdx: number) {
    const mutations = this.mutations.slice();
    mutations.splice(splitIdx, 1);
    return this.rebuildCommands(mutations);
  }

  /**
   * Converts the command at the specified split index.
   */
  convertAtIndex(splitIdx: number, svgChar: SvgChar) {
    const mutations = this.mutations.slice();
    mutations[splitIdx] = _.assign({}, mutations[splitIdx], { svgChar });
    return this.rebuildCommands(mutations);
  }

  /**
   * Unconverts all conversions previously performed on this command mutation.
   */
  unconvertAll() {
    const backingSvgChar = this.backingCommand.svgChar;
    return this.rebuildCommands(this.mutations.map((mutation, i) => {
      let svgChar = backingSvgChar;
      if (backingSvgChar === 'Z' && i !== this.mutations.length - 1) {
        // Force convert the split closepath command back into a line.
        svgChar = 'L';
      }
      return _.assign({}, mutation, { svgChar });
    }));
  }

  // TODO: this could be more efficient (avoid recreating commands unnecessarily)
  private rebuildCommands(mutations: Mutation[]) {
    if (mutations.length === 1) {
      const command = this.mutator.convert(mutations[0].svgChar).toCommand();
      return new CommandMutation({
        backingCommand: this.backingCommand,
        mutations,
        builtCommands: [command],
        mutator: this.mutator,
      });
    }
    const builtCommands: CommandImpl[] = [];
    let prevT = 0;
    for (let i = 0; i < mutations.length; i++) {
      const currT = mutations[i].t;
      let command =
        this.mutator.split(prevT, currT)
          .convert(mutations[i].svgChar)
          .toCommand();
      if (i !== mutations.length - 1) {
        command = command.toggleSplit();
      }
      builtCommands.push(command);
      prevT = currT;
    }
    return new CommandMutation({
      backingCommand: this.backingCommand,
      mutations,
      builtCommands,
      mutator: this.mutator,
    });
  }

  getCommands() {
    return this.builtCommands;
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
  readonly builtCommands: ReadonlyArray<CommandImpl>;
  readonly mutator: Mutator;
}
