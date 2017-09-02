import { Matrix, Point } from 'app/scripts/common';

import { Command } from './Command';
import { SvgChar } from './SvgChar';
import * as SvgUtil from './SvgUtil';

enum Token {
  AbsoluteCommand = 1,
  RelativeCommand,
  Value,
  EOF,
}

/**
 * Takes an SVG path string (i.e. the text specified in the path's 'd' attribute) and returns
 * list of DrawCommands that represent the SVG path's individual sequence of instructions.
 * Arcs are converted to bezier curves because they make life too complicated. :D
 */
export function parseCommands(pathString: string, matrices?: Matrix[]): Command[] {
  // Trim surrounding whitespace.
  pathString = pathString.trim();

  let index = 0;
  let currentToken: Token;

  const advanceToNextTokenFn: (() => Token) = () => {
    while (index < pathString.length) {
      const c = pathString.charAt(index);
      if ('a' <= c && c <= 'z') {
        return (currentToken = Token.RelativeCommand);
      } else if ('A' <= c && c <= 'Z') {
        return (currentToken = Token.AbsoluteCommand);
      } else if (('0' <= c && c <= '9') || c === '.' || c === '-') {
        return (currentToken = Token.Value);
      }
      // Skip unrecognized character.
      index++;
    }
    return (currentToken = Token.EOF);
  };

  const consumeCommandFn = () => {
    advanceToNextTokenFn();
    if (currentToken !== Token.RelativeCommand && currentToken !== Token.AbsoluteCommand) {
      throw new Error('Expected command');
    }
    return pathString.charAt(index++);
  };

  const consumeValueFn = () => {
    advanceToNextTokenFn();
    if (currentToken !== Token.Value) {
      throw new Error('Expected value');
    }

    let start = true;
    let seenDot = false;
    let tempIndex = index;
    while (tempIndex < pathString.length) {
      const c = pathString.charAt(tempIndex);

      if (!('0' <= c && c <= '9') && (c !== '.' || seenDot) && (c !== '-' || !start) && c !== 'e') {
        // End of value.
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

  let currentPoint: Point;

  const consumePointFn = (isRelative: boolean): Point => {
    let x = consumeValueFn();
    let y = consumeValueFn();
    if (isRelative) {
      x += currentPoint.x;
      y += currentPoint.y;
    }
    return { x, y };
  };

  const commands: Command[] = [];
  let currentControlPoint: Point;
  let lastMovePoint: Point;

  while (index < pathString.length) {
    const commandChar = consumeCommandFn();
    const isRelative = currentToken === Token.RelativeCommand;

    switch (commandChar) {
      case 'M':
      case 'm': {
        let isFirstPoint = true;
        while (advanceToNextTokenFn() === Token.Value) {
          const nextPoint = consumePointFn(isRelative && !!currentPoint);

          if (isFirstPoint) {
            isFirstPoint = false;
            commands.push(newMove(currentPoint, nextPoint));
            lastMovePoint = nextPoint;
          } else {
            commands.push(newLine(currentPoint, nextPoint));
          }

          currentControlPoint = undefined;
          currentPoint = nextPoint;
        }
        break;
      }
      case 'C':
      case 'c': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          const cp1 = consumePointFn(isRelative);
          const cp2 = consumePointFn(isRelative);
          const end = consumePointFn(isRelative);
          commands.push(newBezierCurve(currentPoint, cp1, cp2, end));

          currentControlPoint = cp2;
          currentPoint = end;
        }
        break;
      }
      case 'S':
      case 's': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          let cp1;
          const cp2 = consumePointFn(isRelative);
          const end = consumePointFn(isRelative);
          if (currentControlPoint) {
            const x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            const y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
            cp1 = { x, y };
          } else {
            cp1 = cp2;
          }
          commands.push(newBezierCurve(currentPoint, cp1, cp2, end));

          currentControlPoint = cp2;
          currentPoint = end;
        }
        break;
      }
      case 'Q':
      case 'q': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          const cp = consumePointFn(isRelative);
          const end = consumePointFn(isRelative);
          commands.push(newQuadraticCurve(currentPoint, cp, end));

          currentControlPoint = cp;
          currentPoint = end;
        }
        break;
      }
      case 'T':
      case 't': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          let cp;
          const end = consumePointFn(isRelative);
          if (currentControlPoint) {
            const x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            const y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
            cp = { x, y };
          } else {
            cp = end;
          }
          commands.push(newQuadraticCurve(currentPoint, cp, end));

          currentControlPoint = cp;
          currentPoint = end;
        }
        break;
      }
      case 'L':
      case 'l': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          const end = consumePointFn(isRelative);
          commands.push(newLine(currentPoint, end));

          currentControlPoint = undefined;
          currentPoint = end;
        }
        break;
      }
      case 'H':
      case 'h': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          let x = consumeValueFn();
          const y = currentPoint.y;
          if (isRelative) {
            x += currentPoint.x;
          }
          const end = { x, y };
          commands.push(newLine(currentPoint, end));

          currentControlPoint = undefined;
          currentPoint = end;
        }
        break;
      }
      case 'V':
      case 'v': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          const x = currentPoint.x;
          let y = consumeValueFn();
          if (isRelative) {
            y += currentPoint.y;
          }
          const end = { x, y };
          commands.push(newLine(currentPoint, end));

          currentControlPoint = undefined;
          currentPoint = end;
        }
        break;
      }
      case 'A':
      case 'a': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextTokenFn() === Token.Value) {
          const rx = consumeValueFn();
          const ry = consumeValueFn();
          const xAxisRotation = consumeValueFn();
          const largeArcFlag = consumeValueFn();
          const sweepFlag = consumeValueFn();
          const tempPoint1 = consumePointFn(isRelative);

          // Approximate the arc as one or more bezier curves.
          const startX = currentPoint.x;
          const startY = currentPoint.y;
          const endX = tempPoint1.x;
          const endY = tempPoint1.y;
          const bezierCoords = SvgUtil.arcToBeziers({
            startX,
            startY,
            rx,
            ry,
            xAxisRotation,
            largeArcFlag,
            sweepFlag,
            endX,
            endY,
          });

          for (let i = 0; i < bezierCoords.length; i += 8) {
            const endPoint = { x: bezierCoords[i + 6], y: bezierCoords[i + 7] };
            commands.push(
              newBezierCurve(
                currentPoint,
                { x: bezierCoords[i + 2], y: bezierCoords[i + 3] },
                { x: bezierCoords[i + 4], y: bezierCoords[i + 5] },
                endPoint,
              ),
            );
            currentPoint = endPoint;
          }

          currentControlPoint = undefined;
          currentPoint = tempPoint1;
        }
        break;
      }
      case 'Z':
      case 'z': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }
        commands.push(newClosePath(currentPoint, lastMovePoint));
        currentControlPoint = undefined;
        currentPoint = lastMovePoint;
        break;
      }
    }
  }

  if (!matrices) {
    return commands;
  }
  const flattenedMatrices = Matrix.flatten(matrices);
  return commands.map(cmd => {
    return cmd
      .mutate()
      .setId(cmd.getId())
      .transform(flattenedMatrices)
      .build();
  });
}

/**
 * Takes an list of DrawCommands and converts them back into a SVG path string.
 */
export function commandsToString(commands: ReadonlyArray<Command>) {
  const tokens: SvgChar[] = [];
  commands.forEach(cmd => {
    tokens.push(cmd.getSvgChar());
    const isClosePathCommand = cmd.getSvgChar() === 'Z';
    const pointsToNumberListFunc = (...points: Point[]) =>
      points.reduce((list, p) => [...list, p.x, p.y], []);
    const args = pointsToNumberListFunc(...(isClosePathCommand ? [] : cmd.getPoints().slice(1)));
    tokens.splice(tokens.length, 0, ...args.map(n => Number(n.toFixed(3)).toString() as SvgChar));
  });
  return tokens.join(' ');
}

function newMove(start: Point, end: Point) {
  return new Command('M', [start, end]);
}

function newLine(start: Point, end: Point) {
  return new Command('L', [start, end]);
}

function newQuadraticCurve(start: Point, cp: Point, end: Point) {
  return new Command('Q', [start, cp, end]);
}

function newBezierCurve(start: Point, cp1: Point, cp2: Point, end: Point) {
  return new Command('C', [start, cp1, cp2, end]);
}

function newClosePath(start: Point, end: Point) {
  return new Command('Z', [start, end]);
}
