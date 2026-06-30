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
import { pathToFileURL } from "node:url";

export class Database {
  client?: Db;
  #mongoClient?: MongoClient;

  async connect(): Promise<void> {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
    this.#mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await this.#mongoClient.connect();

    this.client = this.#mongoClient.db("music-server");
  }

  async #initModels(): Promise<void> {
    const folder = path.resolve(process.cwd(), "types/db");
    const modelFiles = await listFiles(folder);

    for (const modelFile of modelFiles) {
      const modelModule = await import(pathToFileURL(modelFile).href);
      await modelModule.init(this.client);
    }
  }

  async start(): Promise<void> {
    await this.connect();
    await this.#initModels();
  }

  async disconnect(): Promise<void> {
    await this.#mongoClient?.close();
  }
}
