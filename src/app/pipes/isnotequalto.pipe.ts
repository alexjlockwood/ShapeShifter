import {PipeTransform, Pipe} from '@angular/core';

@Pipe({name: 'isNotEqualTo'})
export class IsNotEqualToPipe implements PipeTransform {

  transform(input: any, other: any): boolean {
    return input !== other;
  }
}
