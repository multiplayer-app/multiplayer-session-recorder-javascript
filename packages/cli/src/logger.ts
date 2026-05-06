/* eslint-disable no-console -- single allowed sink for CLI stdout/stderr */
export type Logger = typeof logger

const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(msg, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(msg, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(msg, ...args),
  debug: (msg: string, ...args: unknown[]) => console.debug(msg, ...args),
}

export { logger }
