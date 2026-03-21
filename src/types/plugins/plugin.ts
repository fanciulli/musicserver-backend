/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { musicServerInstance } from "../../server/music_server.js";

export abstract class Plugin {
  abstract id: string;
  abstract name: string;
  abstract category: string;
  start: () => Promise<void> = async () => {
    const logger = musicServerInstance.getLogger();
    logger.info("Starting plugin " + this.category + "/" + this.id);
  };
  stop: () => Promise<void> = async () => {
    const logger = musicServerInstance.getLogger();
    logger.info("Stopping plugin " + this.category + "/" + this.id);
  };
}
