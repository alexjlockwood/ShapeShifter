import { Point } from './mathutil';
import {
  Command, SimpleCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './svgcommands';


// TODO(alockwood): add 'M 0,0' at the beginning if it doesn't exist?
export function parseCommands(pathString: string): Command[] {
  const commands: Command[] = [];
  let index = 0;
  let length = pathString.length;
  let currentPoint = new Point(0, 0);
  let currentControlPoint = null; // used for S and T commands
  let firstMove = true;
  let lastMovePoint = new Point(0, 0);
  let currentToken: Token;

  const advanceToNextToken_: (() => Token) = () => {
    while (index < length) {
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
    while (tempIndex < length) {
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

  while (index < length) {
    const commandChar = consumeCommand_();
    const relative = currentToken === Token.RelativeCommand;

    switch (commandChar) {
      case 'M':
      case 'm': {
        // move command
        let firstPoint = true;
        let tempPoint1 = new Point(0, 0);
        while (advanceToNextToken_() === Token.Value) {
         tempPoint1 = consumePoint_(relative && !firstMove);
          if (firstPoint) {
            commands.push(new MoveCommand(currentPoint, tempPoint1));
            firstPoint = false;
            if (firstMove) {
              currentPoint = tempPoint1;
              firstMove = false;
            }
            lastMovePoint = tempPoint1;
          } else {
            commands.push(new LineCommand(currentPoint, tempPoint1));
          }
        }

        currentControlPoint = null;
        currentPoint = tempPoint1;
        break;
      }

      case 'C':
      case 'c': {
        // cubic curve command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          const tempPoint1 = consumePoint_(relative);
          const tempPoint2 = consumePoint_(relative);
          const tempPoint3 = consumePoint_(relative);
          commands.push(new BezierCurveCommand(currentPoint, tempPoint1, tempPoint2, tempPoint3));

          currentControlPoint = tempPoint2;
          currentPoint = tempPoint3;
        }

        break;
      }

      case 'S':
      case 's': {
        // cubic curve command (string of curves)
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          const tempPoint1 = consumePoint_(relative);
          const tempPoint2 = consumePoint_(relative);
          let tempPoint3;
          if (currentControlPoint) {
            const x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            const y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
            tempPoint3 = new Point(x, y);
          } else {
            tempPoint3 = tempPoint1;
          }
          commands.push(new BezierCurveCommand(currentPoint, tempPoint3, tempPoint1, tempPoint2));

          currentControlPoint = tempPoint1;
          currentPoint = tempPoint2;
        }

        break;
      }

      case 'Q':
      case 'q': {
        // quadratic curve command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          const tempPoint1 = consumePoint_(relative);
          const tempPoint2 = consumePoint_(relative);
          commands.push(new QuadraticCurveCommand(currentPoint, tempPoint1, tempPoint2));

          currentControlPoint = tempPoint1;
          currentPoint = tempPoint2;
        }

        break;
      }

      case 'T':
      case 't': {
        // quadratic curve command (string of curves)
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          const tempPoint1 = consumePoint_(relative);
          let tempPoint2;
          if (currentControlPoint) {
            const x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            const y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
            tempPoint2 = new Point(x, y);
          } else {
            tempPoint2 = tempPoint1;
          }
          commands.push(new QuadraticCurveCommand(currentPoint, tempPoint2, tempPoint1));

          currentControlPoint = tempPoint2;
          currentPoint = tempPoint1;
        }

        break;
      }

      case 'L':
      case 'l': {
        // line command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          const tempPoint1 = consumePoint_(relative);
          commands.push(new LineCommand(currentPoint, tempPoint1));

          currentControlPoint = null;
          currentPoint = tempPoint1;
        }

        break;
      }

      case 'H':
      case 'h': {
        // horizontal line command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          let x = consumeValue_();
          const y = currentPoint.y;
          if (relative) {
            x += currentPoint.x;
          }
          const tempPoint1 = new Point(x, y);
          commands.push(new LineCommand(currentPoint, tempPoint1));

          currentControlPoint = null;
          currentPoint = tempPoint1;
        }
        break;
      }

      case 'A':
      case 'a': {
        // arc command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
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

      case 'V':
      case 'v': {
        // vertical line command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          const x = currentPoint.x;
          let y = consumeValue_();
          if (relative) {
            y += currentPoint.y;
          }
          const tempPoint1 = new Point(x, y);
          commands.push(new LineCommand(currentPoint, tempPoint1));

          currentControlPoint = null;
          currentPoint = tempPoint1;
        }
        break;
      }

      case 'Z':
      case 'z': {
        // close command
        commands.push(new ClosePathCommand(currentPoint, lastMovePoint));
        break;
      }
    }
  }

  if (!commands.length || !(commands[0] instanceof MoveCommand)) {
    commands.unshift(new MoveCommand(new Point(0, 0), new Point(0, 0)));
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
