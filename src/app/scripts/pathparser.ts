import { Point } from './mathutil';
import {
  Command, SimpleCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './svgcommands';


// TODO(alockwood): add 'M 0,0' at the beginning if it doesn't exist?
export function parseCommands(pathString: string): Command[] {
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

  const consumePoint_ = (relative: boolean): Point => {
    let x = consumeValue_();
    let y = consumeValue_();
    if (relative) {
      x += currentPoint.x;
      y += currentPoint.y;
    }
    return new Point(x, y);
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

  const commands: Command[] = [];
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
            commands.push(new MoveCommand(currentPoint, nextPoint));
            lastMovePoint = nextPoint;
          } else {
            commands.push(new LineCommand(currentPoint, nextPoint));
          }

          currentControlPoint = null;
          currentPoint = nextPoint;
        }

        break;
      }

      case 'C':
      case 'c': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        while (advanceToNextToken_() === Token.Value) {
          const cp1 = consumePoint_(relative);
          const cp2 = consumePoint_(relative);
          const end = consumePoint_(relative);
          commands.push(new BezierCurveCommand(currentPoint, cp1, cp2, end));

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
          commands.push(new BezierCurveCommand(currentPoint, cp1, cp2, end));

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

        while (advanceToNextToken_() === Token.Value) {
          const cp = consumePoint_(relative);
          const end = consumePoint_(relative);
          commands.push(new QuadraticCurveCommand(currentPoint, cp, end));

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
          commands.push(new QuadraticCurveCommand(currentPoint, cp, end));

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

        while (advanceToNextToken_() === Token.Value) {
          const end = consumePoint_(relative);
          commands.push(new LineCommand(currentPoint, end));

          currentControlPoint = null;
          currentPoint = end;
        }

        break;
      }

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
          commands.push(new LineCommand(currentPoint, end));

          currentControlPoint = null;
          currentPoint = end;
        }
        break;
      }

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
          commands.push(new LineCommand(currentPoint, end));

          currentControlPoint = null;
          currentPoint = end;
        }
        break;
      }

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

          commands.push(new EllipticalArcCommand(
            currentPoint.x, currentPoint.y,
            rx, ry,
            xAxisRotation, largeArcFlag, sweepFlag,
            tempPoint1.x, tempPoint1.y));

          currentControlPoint = null;
          currentPoint = tempPoint1;
        }
        break;
      }

      case 'Z':
      case 'z': {
        if (!currentPoint) {
          throw new Error('Current point does not exist');
        }

        commands.push(new ClosePathCommand(currentPoint, lastMovePoint));
        break;
      }
    }
  }

  return commands;
}


export function commandsToString(commands: Command[]) {
  const tokens = [];
  commands.forEach(command => {
    if (command instanceof EllipticalArcCommand) {
      tokens.push('A');
      tokens.splice(tokens.length, 0, command.args.slice(2)); // skip first two arc args
      return;
    }

    if (command instanceof MoveCommand) {
      tokens.push('M');
    } else if (command instanceof LineCommand) {
      tokens.push('L');
    } else if (command instanceof BezierCurveCommand) {
      tokens.push('C');
    } else if (command instanceof QuadraticCurveCommand) {
      tokens.push('Q');
    } else if (command instanceof ClosePathCommand) {
      tokens.push('Z');
    }

    const pointsToNumberList_ = (...points: Point[]) => points.reduce((list, p) => list.concat(p.x, p.y), []);
    const args = pointsToNumberList_(...(command instanceof ClosePathCommand ? [] : command.points.slice(1)));
    tokens.splice(tokens.length, 0, ...args.map(n => Number(n.toFixed(3)).toString()));
  });

  return tokens.join(' ');
}


const enum Token {
  AbsoluteCommand,
  RelativeCommand,
  Value,
  EOF,
}
