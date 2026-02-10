/*
 * Created on Thu Feb 05 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Sequelize } from "sequelize";
import { listFiles } from "../utils/fsUtils";
import path from "node:path";

export class Database {
  #client: Sequelize;

  async connect(): Promise<Boolean> {
    this.#client = new Sequelize("music_server_schema", "root", "passwd", {
      host: "localhost",
      dialect: "mysql",
    });

    try {
      await this.#client.authenticate();
      return true;
    } catch (error) {
      return false;
    }
  }

  async #initModels(): Promise<void> {
    const folder = path.resolve(process.cwd(), "types/db");
    const modelFiles = await listFiles(folder);

    for (const modelFile of modelFiles) {
      const modelModule = await import(path.join(folder, modelFile));
      modelModule.default.init(this.#client);
    }
  }

  async start(): Promise<Boolean> {
    const connected = await this.connect();
    if (connected) {
      await this.#initModels();
      await this.#client.sync({ alter: true });
      return true;
    } else {
      console.log("Cannot connect to database");
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.#client.close();
  }

  getModels() {
    return this.#client?.models;
  }
}
