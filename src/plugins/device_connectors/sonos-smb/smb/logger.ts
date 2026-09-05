/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

/** Shared logger shape, matching the plugin's context logger (pino-like). */
export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
  debug?(...args: unknown[]): void;
}
