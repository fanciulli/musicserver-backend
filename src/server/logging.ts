/*
 * Created on Mon Feb 09 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Db } from "mongodb";
import { LOGS_COLLECTION } from "../types/db/logLine.js";

interface BufferedEntry {
  level: string;
  message: string;
  timestamp: Date;
}

export class Logger {
  #db?: Db;
  #buffer: BufferedEntry[] = [];

  setDatabase(db: Db): void {
    if (this.#db) return;
    this.#db = db;
    this.#flushBuffer();
  }

  #flushBuffer(): void {
    if (!this.#db) return;
    const collection = this.#db.collection(LOGS_COLLECTION);
    for (const entry of this.#buffer) {
      collection.insertOne({ ...entry, logId: "main" }).catch((e) => console.error("[Logger] insertOne failed:", e));
    }
    this.#buffer = [];
  }

  #log(level: string, message: string): void {
    const entry: BufferedEntry = { level, message, timestamp: new Date() };
    if (this.#db) {
      this.#db
        .collection(LOGS_COLLECTION)
        .insertOne({ ...entry, logId: "main" })
        .catch((e) => console.error("[Logger] insertOne failed:", e));
    } else {
      this.#buffer.push(entry);
    }
  }

  info(message: string): void {
    this.#log("info", message);
  }

  error(message: string): void {
    this.#log("error", message);
  }

  debug(message: string): void {
    this.#log("debug", message);
  }
}
