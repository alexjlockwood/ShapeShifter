import * as _ from 'lodash';
import { Pipe, PipeTransform } from '@angular/core';
import { Command } from '../scripts/commands';

@Pipe({ name: 'toSvgText' })
export class SvgCommandPipe implements PipeTransform {
  transform(c: Command): string {
    if (c.svgChar === 'Z') {
      return `${c.svgChar}`;
    } else {
      const p = _.last(c.points);
      const x = _.round(p.x, 2);
      const y = _.round(p.y, 2);
      return `${c.svgChar} ${x}, ${y}`;
    }
  }
}
