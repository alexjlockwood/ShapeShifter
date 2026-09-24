import { environment } from './environment';

export const version = `${__APP_VERSION__}-${environment.beta ? 'beta' : 'stable'}`;
