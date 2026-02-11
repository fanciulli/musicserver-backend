/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export abstract class Plugin {
  abstract id: string;
  abstract name: string;
  abstract category: string;
  start: () => Promise<void> = async () => {
    console.log("Starting plugin " + this.category + "/" + this.id);
  };
  stop: () => Promise<void> = async () => {
    console.log("Stopping plugin " + this.category + "/" + this.id);
  };
}
