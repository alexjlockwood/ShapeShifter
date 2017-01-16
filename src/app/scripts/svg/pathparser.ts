import { Point, Matrix, MathUtil } from '../common';
import * as SvgUtil from './svgutil';
import {
  DrawCommandImpl, moveTo, lineTo, quadTo, cubicTo, arcTo, closePath
} from './drawcommand';

/**
 * Takes an SVG path string (i.e. the text specified in the path's 'd' attribute) and returns
 * list of DrawCommands that represent the SVG path's individual sequence of instructions.
 */
export function parseCommands(pathString: string, matrices?: Matrix[]): DrawCommandImpl[] {
  let index = 0;
  let currentPoint: Point;
  let currentToken: Token;

  const advanceToNextToken_: (() => Token) = () => {
    while (index < pathString.length) {
      const c = pathString.charAt(index);
      if ('a' <= c && c <= 'z') {
        return (currentToken = Token.RelativeCommand);
      } else if ('A' <= c && c <= 'Z') {
        return (currentToken = Token.AbsoluteCommand);
      } else if (('0' <= c && c <= '9') || c === '.' || c === '-') {
        return (currentToken = Token.Value);
      }
      // skip unrecognized character
      index++;
    }
    return (currentToken = Token.EOF);
  };

  const consumeCommand_ = () => {
    advanceToNextToken_();
    if (currentToken !== Token.RelativeCommand && currentToken !== Token.AbsoluteCommand) {
      throw new Error('Expected command');
    }
    return pathString.charAt(index++);
  };

  const consumeValue_ = () => {
    advanceToNextToken_();
    if (currentToken !== Token.Value) {
      throw new Error('Expected value');
    }

    let start = true;
    let seenDot = false;
    let tempIndex = index;
    while (tempIndex < pathString.length) {
      const c = pathString.charAt(tempIndex);

      if (!('0' <= c && c <= '9') && (c !== '.' || seenDot) && (c !== '-' || !start) && c !== 'e') {
        // end of value
        break;
      }

      if (c === '.') {
        seenDot = true;
      }

      start = false;
      if (c === 'e') {
        start = true;
      }
      tempIndex++;
    }

    if (tempIndex === index) {
      throw new Error('Expected value');
    }

    const str = pathString.substring(index, tempIndex);
    index = tempIndex;
    return parseFloat(str);
  };

  const consumePoint_ = (relative: boolean): Point => {
    let x = consumeValue_();
    let y = consumeValue_();
    if (relative) {
      x += currentPoint.x;
      y += currentPoint.y;
    }
    return new Point(x, y);
  };

  const commands: DrawCommandImpl[] = [];
  let currentControlPoint: Point;
  let lastMovePoint: Point;

  while (index < pathString.length) {
    const commandChar = consumeCommand_();
    const relative = currentToken === Token.RelativeCommand;

    switch (commandChar) {
      case 'M':
      case 'm': {
        if (relative && !currentPoint) {
          throw new Error('Current point must be set for a relative command');
        }

        let isFirstPoint = true;
        while (advanceToNextToken_() === Token.Value) {
          const nextPoint = consumePoint_(relative);

          if (isFirstPoint) {
            isFirstPoint = false;
            commands.push(moveTo(currentPoint, nextPoint));
            lastMovePoint = nextPoint;
          } else {
            commands.push(lineTo(currentPoint, nextPoint));
          }

          currentControlPoint = undefined;
          currentPoint = nextPoint;
        }
      }
        break;
      case 'C':
      case 'c': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          const cp1 = consumePoint_(relative);
          const cp2 = consumePoint_(relative);
          const end = consumePoint_(relative);
          commands.push(cubicTo(currentPoint, cp1, cp2, end));

          currentControlPoint = cp2;
          currentPoint = end;
        }
      }
        break;
      case 'S':
      case 's': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          let cp1;
          const cp2 = consumePoint_(relative);
          const end = consumePoint_(relative);
          if (currentControlPoint) {
            const x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            const y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
            cp1 = new Point(x, y);
          } else {
            cp1 = cp2;
          }
          commands.push(cubicTo(currentPoint, cp1, cp2, end));

          currentControlPoint = cp2;
          currentPoint = end;
        }
      }
        break;
      case 'Q':
      case 'q': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          const cp = consumePoint_(relative);
          const end = consumePoint_(relative);
          commands.push(quadTo(currentPoint, cp, end));

          currentControlPoint = cp;
          currentPoint = end;
        }
      }
        break;
      case 'T':
      case 't': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          let cp;
          const end = consumePoint_(relative);
          if (currentControlPoint) {
            const x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            const y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
            cp = new Point(x, y);
          } else {
            cp = end;
          }
          commands.push(quadTo(currentPoint, cp, end));

          currentControlPoint = cp;
          currentPoint = end;
        }
      }
        break;
      case 'L':
      case 'l': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          const end = consumePoint_(relative);
          commands.push(lineTo(currentPoint, end));

          currentControlPoint = undefined;
          currentPoint = end;
        }
      }
        break;
      case 'H':
      case 'h': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          let x = consumeValue_();
          const y = currentPoint.y;
          if (relative) {
            x += currentPoint.x;
          }
          const end = new Point(x, y);
          commands.push(lineTo(currentPoint, end));

          currentControlPoint = undefined;
          currentPoint = end;
        }
      }
        break;
      case 'V':
      case 'v': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          const x = currentPoint.x;
          let y = consumeValue_();
          if (relative) {
            y += currentPoint.y;
          }
          const end = new Point(x, y);
          commands.push(lineTo(currentPoint, end));

          currentControlPoint = undefined;
          currentPoint = end;
        }
      }
        break;
      case 'A':
      case 'a': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          const rx = consumeValue_();
          const ry = consumeValue_();
          const xAxisRotation = consumeValue_();
          const largeArcFlag = consumeValue_();
          const sweepFlag = consumeValue_();
          const tempPoint1 = consumePoint_(relative);

          commands.push(arcTo(
            new Point(currentPoint.x, currentPoint.y),
            rx, ry,
            xAxisRotation, largeArcFlag, sweepFlag,
            new Point(tempPoint1.x, tempPoint1.y)));

          currentControlPoint = undefined;
          currentPoint = tempPoint1;
        }
      }
        break;
      case 'Z':
      case 'z': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }
        commands.push(closePath(currentPoint, lastMovePoint));
      }
        break;
    }
  }

  return matrices ? commands.map(cmd => cmd.transform(matrices)) : commands;
}

/**
 * Takes an list of DrawCommands and converts them back into a SVG path string.
 */
export function commandsToString(commands: DrawCommandImpl[]) {
  const tokens = [];
  commands.forEach(cmd => {
    tokens.push(cmd.svgChar);
    if (cmd.svgChar === 'A') {
      tokens.splice(tokens.length, 0, cmd.args.slice(2)); // skip first two arc args
      return;
    }
    const isClosePathCommand = cmd.svgChar === 'Z';
    const pointsToNumberListFunc =
      (...points: Point[]) => points.reduce((list, p) => list.concat(p.x, p.y), []);
    const args = pointsToNumberListFunc(...(isClosePathCommand ? [] : cmd.points.slice(1)));
    tokens.splice(tokens.length, 0, ...args.map(n => Number(n.toFixed(3)).toString()));
  });

  return tokens.join(' ');
}

/** Transforms the provided path string. */
export function transformPathString(pathString: string, matrices: Matrix[]): string {
  return commandsToString(parseCommands(pathString, matrices));
}

const enum Token {
  AbsoluteCommand,
  RelativeCommand,
  Value,
  EOF,
}
