/*
 * Created on Mon Mar 23 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { join } from "path";
import pino from "pino";

export function createRollingTransport(logFileName: string) {
  return pino.transport({
    target: "pino-roll",
    options: {
      file: join("logs", logFileName),
      size: 1,
      frequency: "daily",
      mkdir: true,
      dateFormat: "yyyy-MM-dd",
    },
  });
}

export function createRollingLogger(logFileName: string) {
  return pino(createRollingTransport(logFileName));
}
