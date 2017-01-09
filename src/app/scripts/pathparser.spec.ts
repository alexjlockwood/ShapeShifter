import { } from 'jasmine';
import * as PathParser from './pathparser';
import { CommandListBuilder } from './testutil';

// describe('PathParser', () => {
//   it('M 0 0 M 10 10 M 20 20 M 30 30', () => {
//     const actual = PathParser.parseCommands('M 0 0 M 10 10 M 20 20 M 30 30');
//     const expected = new CommandListBuilder()
//       .moveTo(0, 0).moveTo(10, 10).moveTo(20, 20).moveTo(30, 30).build();
//     expect(actual).toEqual(expected);
//   });

//   it('M 0 0 L 10 10 L 20 20 L 30 30', () => {
//     const actual = PathParser.parseCommands('M 0 0 L 10 10 L 20 20 L 30 30');
//     const expected = new CommandListBuilder()
//       .moveTo(0, 0).lineTo(10, 10).lineTo(20, 20).lineTo(30, 30).build();
//     expect(actual).toEqual(expected);
//   });

//   it('M 0 0 10 10 20 20 30 30', () => {
//     const actual = PathParser.parseCommands('M 0 0 10 10 20 20 30 30');
//     const expected = new CommandListBuilder()
//       .moveTo(0, 0).lineTo(10, 10).lineTo(20, 20).lineTo(30, 30).build();
//     expect(actual).toEqual(expected);
//   });

//   it('M 0 0 L 10 10 20 20 L 30 30', () => {
//     const actual = PathParser.parseCommands('M 0 0 L 10 10 20 20 L 30 30');
//     const expected = new CommandListBuilder()
//       .moveTo(0, 0).lineTo(10, 10).lineTo(20, 20).lineTo(30, 30).build();
//     expect(actual).toEqual(expected);
//   });

//   it('M 0 0 L 12 12 C 16 16 20 20 24 24', () => {
//     const actual = PathParser.parseCommands('M 0 0 L 12 12 C 16 16 20 20 24 24');
//     const expected = new CommandListBuilder()
//       .moveTo(0, 0)
//       .lineTo(12, 12)
//       .bezierTo(16, 16, 20, 20, 24, 24)
//       .build();
//     expect(actual).toEqual(expected);
//   });
// });
