import { environment } from './environment';

export const version = `${require('../../package.json').version}-${
  environment.beta ? 'beta' : 'stable'
}`;
