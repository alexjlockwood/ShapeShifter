import { INIT_ACTION } from 'app/store/ngrx';

declare var console;
const logger = console;

const repeat = (str, times) => new Array(times + 1).join(str);
const pad = (num, maxLength) => repeat(`0`, maxLength - num.toString().length) + num;
const formatTime = time =>
  `@ ${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(
    time.getMilliseconds(),
    3,
  )}`;
const timer =
  typeof performance !== `undefined` && typeof performance.now === `function` ? performance : Date;

const getLogLevel = (level, action, payload, type) => {
  switch (typeof level) {
    case `object`:
      return typeof level[type] === `function` ? level[type](...payload) : level[type];
    case `function`:
      return level(action);
    default:
      return level;
  }
};

const printBuffer = options => logBuffer => {
  const { actionTransformer, collapsed, colors, timestamp, duration, level } = options;
  logBuffer.forEach((logEntry, key) => {
    const { started, startedTime, action, error } = logEntry;
    const prevState = logEntry.prevState.nextState ? logEntry.prevState.nextState : '(Empty)';
    let { took, nextState } = logEntry;
    const nextEntry = logBuffer[key + 1];
    if (nextEntry) {
      nextState = nextEntry.prevState;
      took = nextEntry.started - started;
    }

    const formattedAction = actionTransformer(action);
    const isCollapsed =
      typeof collapsed === `function` ? collapsed(() => nextState, action) : collapsed;

    const formattedTime = formatTime(startedTime);
    const titleCSS = colors.title ? `color: ${colors.title(formattedAction)};` : undefined;
    const title = `action ${timestamp ? formattedTime : ``} ${formattedAction.type} ${duration
      ? `(in ${took.toFixed(2)} ms)`
      : ``}`;

    try {
      if (isCollapsed) {
        if (colors.title) {
          logger.groupCollapsed(`%c ${title}`, titleCSS);
        } else {
          logger.groupCollapsed(title);
        }
      } else {
        if (colors.title) {
          logger.group(`%c ${title}`, titleCSS);
        } else {
          logger.group(title);
        }
      }
    } catch (e) {
      logger.log(title);
    }

    const prevStateLevel = getLogLevel(level, formattedAction, [prevState], `prevState`);
    const actionLevel = getLogLevel(level, formattedAction, [formattedAction], `action`);
    const errorLevel = getLogLevel(level, formattedAction, [error, prevState], `error`);
    const nextStateLevel = getLogLevel(level, formattedAction, [nextState], `nextState`);

    if (prevStateLevel) {
      if (colors.prevState) {
        logger[prevStateLevel](
          `%c prev state`,
          `color: ${colors.prevState(prevState)}; font-weight: bold`,
          prevState,
        );
      } else {
        logger[prevStateLevel](`prev state`, prevState);
      }
    }

    if (actionLevel) {
      if (colors.action) {
        logger[actionLevel](
          `%c action`,
          `color: ${colors.action(formattedAction)}; font-weight: bold`,
          formattedAction,
        );
      } else {
        logger[actionLevel](`action`, formattedAction);
      }
    }

    if (error && errorLevel) {
      if (colors.error) {
        logger[errorLevel](
          `%c error`,
          `color: ${colors.error(error, prevState)}; font-weight: bold`,
          error,
        );
      } else {
        logger[errorLevel](`error`, error);
      }
    }

    if (nextStateLevel) {
      if (colors.nextState) {
        logger[nextStateLevel](
          `%c next state`,
          `color: ${colors.nextState(nextState)}; font-weight: bold`,
          nextState,
        );
      } else {
        logger[nextStateLevel](`next state`, nextState);
      }
    }

    try {
      logger.groupEnd();
    } catch (e) {
      logger.log(`—— log end ——`);
    }
  });
  logBuffer.length = 0;
};

const isAllowed = (action, filter) => {
  if (!filter) {
    return true;
  }
  if (filter.whitelist && filter.whitelist.length) {
    return filter.whitelist.indexOf(action.type) !== -1;
  }
  return filter.blacklist && filter.blacklist.indexOf(action.type) === -1;
};

export const metaReducer = (opts: LoggerOptions = {}) => (reducer: Function) => {
  let log = {};
  const ua =
    typeof window !== 'undefined' && window.navigator.userAgent ? window.navigator.userAgent : '';
  let ms_ie = false;
  // Fix for action display in IE.
  const old_ie = ua.indexOf('MSIE ');
  const new_ie = ua.indexOf('Trident/');

  if (old_ie > -1 || new_ie > -1) {
    ms_ie = true;
  }

  let colors: LoggerColorsOption;
  if (ms_ie) {
    // Setting colors functions to null when it's an IE browser.
    colors = {
      title: undefined,
      prevState: undefined,
      action: undefined,
      nextState: undefined,
      error: undefined,
    };
  } else {
    colors = {
      title: undefined,
      prevState: () => '#9E9E9E',
      action: () => '#03A9F4',
      nextState: () => '#4CAF50',
      error: () => '#F20404',
    };
  }

  const defaults: LoggerOptions = {
    level: 'log',
    collapsed: false,
    duration: true,
    timestamp: true,
    stateTransformer: state => state,
    actionTransformer: actn => actn,
    filter: {
      whitelist: [],
      blacklist: [],
    },
    colors: colors,
  };

  const options = { ...defaults, ...opts };
  const { stateTransformer } = options;
  const buffer = printBuffer(options);

  return function(state, action) {
    const preLog = {
      started: timer.now(),
      startedTime: new Date(),
      prevState: stateTransformer(log),
      action,
    };
    const nextState = reducer(state, action);
    const postLog = {
      took: timer.now() - preLog.started,
      nextState: stateTransformer(nextState),
    };
    log = { ...preLog, ...postLog };
    // Ignore init action fired by store and devtools.
    if (action.type !== INIT_ACTION && isAllowed(action, options.filter)) {
      buffer([log]);
    }

    return nextState;
  };
};

export interface LoggerOptions {
  /**
   * 'log' | 'console' | 'warn' | 'error' | 'info'. Default: 'log'
   */
  level?: any;
  /**
   * Should log group be collapsed? default: false
   */
  collapsed?: boolean;
  /**
   * Print duration with action? default: true
   */
  duration?: boolean;
  /**
   * Print timestamp with action? default: true
   */
  timestamp?: boolean;
  filter?: LoggerFilterOption;
  /**
   * Transform state before print default: state => state
   */
  stateTransformer?: (state: Object) => Object;
  /**
   * Transform action before print default: actn => actn
   */
  actionTransformer?: (actn: Object) => Object;
  colors?: LoggerColorsOption;
}

export interface LoggerFilterOption {
  /**
   * Only print actions included in this list - has priority over blacklist
   */
  whitelist?: string[];
  /**
   * Only print actions that are NOT included in this list
   */
  blacklist?: string[];
}

export interface LoggerColorsOption {
  title: (action: Object) => string;
  prevState: (prevState: Object) => string;
  action: (action: Object) => string;
  nextState: (nextState: Object) => string;
  error: (error: any, prevState: Object) => string;
}
