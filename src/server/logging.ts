/*
 * Created on Mon Feb 09 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { join } from "path";
import pino from "pino";

const transport = pino.transport({
  target: "pino-roll",
  options: {
    file: join("logs", "main"),
    size: 1,
    frequency: "daily",
    mkdir: true,
    dateFormat: "yyyy-MM-dd",
  },
});

const logger = pino(transport);

export class Logger {
  info(message: string): void {
    logger.info(message);
  }

  error(message: string): void {
    logger.error(message);
  }
}
