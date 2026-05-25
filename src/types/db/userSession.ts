import type { Db } from "mongodb";
import { v4 } from "uuid";

const COLLECTION_NAME = "user_sessions";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export class UserSessionDbModel {
  id: string = v4();
  username: string = "";
  tokenHash: string = "";
  createdAt: Date = new Date();
  expiresAt: Date = new Date(Date.now() + SESSION_DURATION_MS);

  static async findValid(
    db: Db,
    username: string,
    tokenHash: string,
  ): Promise<UserSessionDbModel | undefined> {
    const result = await db
      .collection<UserSessionDbModel>(COLLECTION_NAME)
      .findOne({ username, tokenHash, expiresAt: { $gt: new Date() } });
    return result ?? undefined;
  }

  static async deleteByUsername(db: Db, username: string): Promise<void> {
    await db
      .collection<UserSessionDbModel>(COLLECTION_NAME)
      .deleteMany({ username });
  }

  async insert(db: Db): Promise<void> {
    await db
      .collection<UserSessionDbModel>(COLLECTION_NAME)
      .insertOne(this);
  }
}

export async function init(db: Db): Promise<void> {
  await db.collection(COLLECTION_NAME).createIndex({ tokenHash: 1 });
  await db
    .collection(COLLECTION_NAME)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
