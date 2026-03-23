/*
 * Created on Thu Feb 05 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { MongoClient, Db } from "mongodb";
import { listFiles } from "../utils/fsUtils.js";
import path from "node:path";

export class Database {
  client: Db;

  async connect(): Promise<void> {
    const uri = "mongodb://localhost:27017";
    const mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await mongoClient.connect();

    this.client = mongoClient.db("music-server");
  }

  async #initModels(): Promise<void> {
    const folder = path.resolve(process.cwd(), "types/db");
    const modelFiles = await listFiles(folder);

    for (const modelFile of modelFiles) {
      const modelModule = await import(modelFile);
      modelModule.init(this.client);
    }
  }

  async start(): Promise<void> {
    await this.connect();
    await this.#initModels();
  }

  async disconnect(): Promise<void> {
    await this.client.client.close();
  }
}
