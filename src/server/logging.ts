/*
 * Created on Mon Feb 09 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { createRollingLogger } from "./loggingRollingTransport.js";

const logger = createRollingLogger("main");

export class Logger {
  info(message: string): void {
    logger.info(message);
  }

  error(message: string): void {
    logger.error(message);
  }
}
