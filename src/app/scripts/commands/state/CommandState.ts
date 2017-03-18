import * as _ from 'lodash';
import { MathUtil, Point, Matrix } from '../../common';
import { Calculator, newCalculator, BBox, Line } from '../calculators';
import { SvgChar, ProjectionResult } from '..';
import { CommandImpl } from '../CommandImpl';
import { CommandStateMutator } from './CommandMutator';

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

  // The calculator that will do all of the math-y stuff for us.
  private readonly calculator: Calculator;

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
      this.transforms = [new Matrix()];
      this.commands = [obj];
      this.calculator = newCalculator(this.backingCommand);
    } else {
      this.backingCommand = obj.backingCommand;
      this.mutations = obj.mutations;
      this.transforms = obj.transforms;
      this.commands = obj.commands;
      this.calculator = obj.calculator;
    }
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

  getIdAtIndex(splitIdx: number) {
    return this.mutations[splitIdx].id;
  }

  /**
   * Returns the command's total path length.
   */
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
        .map(mutation => mutation.t < projectionResult.t ? 1 : 0)
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
  readonly backingCommand: CommandImpl;
  readonly mutations: ReadonlyArray<Mutation>;
  readonly transforms: ReadonlyArray<Matrix>;
  readonly commands: ReadonlyArray<CommandImpl>;
  readonly calculator: Calculator;
}
