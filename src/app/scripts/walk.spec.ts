import './walk';
import * as _ from 'lodash';

describe('Walk', () => {
  it('walk', () => {
    const tree = {
      'name': { 'first': 'Bucky', 'last': 'Fuller' },
      'occupations': ['designer', 'inventor'],
    };
    _.walk.preorder(tree, function(value, key, parent) {
      console.log(key + ': ' + value);
    });
    expect(true).toEqual(true);
  });
});
