/*
 * Created on Mon May 19 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Writable } from "stream";
import type { Db } from "mongodb";
import pino from "pino";

const COLLECTION_NAME = "logs";

function pinoLevelToString(level: number): string {
  if (level >= 60) return "fatal";
  if (level >= 50) return "error";
  if (level >= 40) return "warn";
  if (level >= 30) return "info";
  if (level >= 20) return "debug";
  return "trace";
}

export function createDatabaseLogger(logId: string, db: Db) {
  const stream = new Writable({
    write(chunk: Buffer, _enc: string, cb: (err?: Error | null) => void) {
      const line = chunk.toString().trim();
      if (!line) {
        cb();
        return;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(line);
      } catch {
        cb();
        return;
      }
      db.collection(COLLECTION_NAME)
        .insertOne({
          logId,
          timestamp: new Date(parsed.time),
          level: pinoLevelToString(parsed.level),
          message: parsed.msg,
        })
        .then(() => cb())
        .catch((err) => cb(err));
    },
  });
  return pino(stream);
}
