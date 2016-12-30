import { Point } from './mathutil';
import {
  Command, SimpleCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './svgcommands';


export function parseCommands(pathString: string) {
  let commands: Command[] = [];
  let index = 0;
  let length = pathString.length;
  let currentPoint = new Point(NaN, NaN);
  let currentControlPoint = null; // used for S and T commands
  let tempPoint1 = new Point(0, 0);
  let tempPoint2 = new Point(0, 0);
  let tempPoint3 = new Point(0, 0);
  let firstMove = true;
  let currentToken: Token;

  let advanceToNextToken_: () => Token = () => {
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

  let consumeCommand_ = () => {
    advanceToNextToken_();
    if (currentToken !== Token.RelativeCommand && currentToken !== Token.AbsoluteCommand) {
      throw new Error('Expected command');
    }
    return pathString.charAt(index++);
  };

  let consumePoint_ = (out: Point, relative: boolean) => {
    out.x = consumeValue_();
    out.y = consumeValue_();
    if (relative) {
      out.x += currentPoint.x;
      out.y += currentPoint.y;
    }
  };

  let consumeValue_ = () => {
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
    const relative = (currentToken === Token.RelativeCommand);

    switch (commandChar) {
      case 'M':
      case 'm': {
        // move command
        let firstPoint = true;
        while (advanceToNextToken_() === Token.Value) {
          consumePoint_(tempPoint1, relative && !isNaN(currentPoint.x));
          if (firstPoint) {
            commands.push(new MoveCommand(new Point(0, 0), tempPoint1));
            firstPoint = false;
            if (firstMove) {
              currentPoint = Point.from(tempPoint1);
              firstMove = false;
            }
          } else {
            commands.push(new LineCommand(currentPoint, tempPoint1));
          }
        }

        currentControlPoint = null;
        currentPoint = Point.from(tempPoint1);
        break;
      }

      case 'C':
      case 'c': {
        // cubic curve command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === Token.Value) {
          consumePoint_(tempPoint1, relative);
          consumePoint_(tempPoint2, relative);
          consumePoint_(tempPoint3, relative);
          commands.push(new BezierCurveCommand(currentPoint, tempPoint1, tempPoint2, tempPoint3));

          currentControlPoint = Point.from(tempPoint2);
          currentPoint = Point.from(tempPoint3);
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
          consumePoint_(tempPoint1, relative);
          consumePoint_(tempPoint2, relative);
          if (currentControlPoint) {
            tempPoint3.x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            tempPoint3.y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
          } else {
            tempPoint3 = Point.from(tempPoint1);
          }
          commands.push(new BezierCurveCommand(currentPoint, tempPoint3, tempPoint1, tempPoint2));

          currentControlPoint = Point.from(tempPoint1);
          currentPoint = Point.from(tempPoint2);
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
          consumePoint_(tempPoint1, relative);
          consumePoint_(tempPoint2, relative);
          commands.push(new QuadraticCurveCommand(currentPoint, tempPoint1, tempPoint2));

          currentControlPoint = Point.from(tempPoint1);
          currentPoint = Point.from(tempPoint2);
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
          consumePoint_(tempPoint1, relative);
          if (currentControlPoint) {
            tempPoint2.x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            tempPoint2.y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
          } else {
            tempPoint2 = Point.from(tempPoint1);
          }
          commands.push(new QuadraticCurveCommand(currentPoint, tempPoint2, tempPoint1));

          currentControlPoint = Point.from(tempPoint2);
          currentPoint = Point.from(tempPoint1);
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
          consumePoint_(tempPoint1, relative);
          commands.push(new LineCommand(currentPoint, tempPoint1));

          currentControlPoint = null;
          currentPoint = Point.from(tempPoint1);
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
          tempPoint1.x = consumeValue_();
          tempPoint1.y = currentPoint.y;
          if (relative) {
            tempPoint1.x += currentPoint.x;
          }
          commands.push(new LineCommand(currentPoint, tempPoint1));

          currentControlPoint = null;
          currentPoint = Point.from(tempPoint1);
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
          let rx = consumeValue_();
          let ry = consumeValue_();
          let xAxisRotation = consumeValue_();
          let largeArcFlag = consumeValue_();
          let sweepFlag = consumeValue_();
          consumePoint_(tempPoint1, relative);

          commands.push(new EllipticalArcCommand(
            currentPoint.x, currentPoint.y,
            rx, ry,
            xAxisRotation, largeArcFlag, sweepFlag,
            tempPoint1.x, tempPoint1.y));

          // pp.addMarkerAngle(halfWay, ah - dir * Math.PI / 2);
          // pp.addMarkerAngle(tempPoint1, ah - dir * Math.PI);

          currentControlPoint = null;
          currentPoint = Point.from(tempPoint1);
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
          tempPoint1.y = consumeValue_();
          tempPoint1.x = currentPoint.x;
          if (relative) {
            tempPoint1.y += currentPoint.y;
          }
          commands.push(new LineCommand(currentPoint, tempPoint1));

          currentControlPoint = null;
          currentPoint = Point.from(tempPoint1);
        }
        break;
      }

      case 'Z':
      case 'z': {
        // close command
        commands.push(new ClosePathCommand());
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
    const args = pointsToNumberList_(...command.points.slice(1));
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
