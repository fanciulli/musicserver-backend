/*
 * Created on Tue May 19 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";

export const LOGS_COLLECTION = "logs";

export interface LogLineQuery {
  logId: string;
  level?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export class LogLineDbModel {
  logId!: string;
  timestamp!: Date;
  level?: string;
  message?: string;

  static fromJson(json: Partial<LogLineDbModel>): LogLineDbModel {
    const entry = new LogLineDbModel();
    entry.logId = json.logId!;
    entry.timestamp = json.timestamp!;
    entry.level = json.level;
    entry.message = json.message;
    return entry;
  }

  static async query(
    db: Db,
    filter: LogLineQuery,
  ): Promise<{ entries: LogLineDbModel[]; total: number }> {
    const query: Record<string, any> = { logId: filter.logId };
    if (filter.level !== undefined) query.level = filter.level;
    if (filter.from !== undefined || filter.to !== undefined) {
      query.timestamp = {};
      if (filter.from !== undefined) query.timestamp.$gte = filter.from;
      if (filter.to !== undefined) query.timestamp.$lte = filter.to;
    }

    const limit = filter.limit ?? 50;
    const skip = ((filter.page ?? 1) - 1) * limit;
    const collection = db.collection<LogLineDbModel>(LOGS_COLLECTION);

    const [docs, total] = await Promise.all([
      collection.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);

    return { entries: docs.map(LogLineDbModel.fromJson), total };
  }

}

export function init(db: Db): void {
  db.collection(LOGS_COLLECTION)
    .createIndex({ logId: 1, timestamp: -1 })
    .catch((err) => console.error("Failed to create logs index:", err));
}
