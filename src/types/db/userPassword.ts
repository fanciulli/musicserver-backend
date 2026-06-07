import type { Db } from "mongodb";
import { v4 } from "uuid";
import { hashPassword } from "../../utils/sessionAuthUtils.js";

const COLLECTION_NAME = "user_passwords";

export class UserPasswordDbModel {
  id: string = v4();
  username: string = "";
  passwordHash: string = "";
  createdAt: Date = new Date();

  static async findByUsername(
    db: Db,
    username: string,
  ): Promise<UserPasswordDbModel | undefined> {
    const result = await db
      .collection<UserPasswordDbModel>(COLLECTION_NAME)
      .findOne({ username });
    return result ?? undefined;
  }

  static async updateHash(
    db: Db,
    username: string,
    passwordHash: string,
  ): Promise<void> {
    await db
      .collection<UserPasswordDbModel>(COLLECTION_NAME)
      .updateOne({ username }, { $set: { passwordHash } });
  }

  async insert(db: Db): Promise<void> {
    await db
      .collection<UserPasswordDbModel>(COLLECTION_NAME)
      .insertOne(this);
  }
}

export async function init(db: Db): Promise<void> {
  await db
    .collection(COLLECTION_NAME)
    .createIndex({ username: 1 }, { unique: true });

  const adminExists = await db
    .collection(COLLECTION_NAME)
    .findOne({ username: "admin" });

  if (!adminExists) {
    const model = new UserPasswordDbModel();
    model.username = "admin";
    model.passwordHash = await hashPassword("admin");
    await model.insert(db);
  }
}
