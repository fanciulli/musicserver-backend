/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Context } from "../context.js";

export abstract class Plugin {
  abstract id: string;
  abstract name: string;
  abstract category: string;
  context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  start: () => Promise<void> = async () => {
    this.context.logger.info(
      "Starting plugin " + this.category + "/" + this.id,
    );
  };
  stop: () => Promise<void> = async () => {
    this.context.logger.info(
      "Stopping plugin " + this.category + "/" + this.id,
    );
  };
}
