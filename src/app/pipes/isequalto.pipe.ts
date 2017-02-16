import {PipeTransform, Pipe} from '@angular/core';

@Pipe({name: 'isEqualTo'})
export class IsEqualToPipe implements PipeTransform {

  transform(input: any, other: any): boolean {
    return input === other;
  }
}
