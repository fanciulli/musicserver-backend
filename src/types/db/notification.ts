/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Db } from "mongodb";
import { v4 } from "uuid";
import { MILLISECONDS_PER_DAY } from "../../misc/constants.js";

const COLLECTION_NAME = "notifications";

export const NotificationTypes = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type NotificationType =
  (typeof NotificationTypes)[keyof typeof NotificationTypes];

export const NOTIFICATION_TYPE_VALUES: NotificationType[] =
  Object.values(NotificationTypes);

export type NotificationInput = {
  title: string;
  message: string;
  type: NotificationType;
};

export class NotificationDbModel {
  id: string = v4();
  recipient: string | null = null;
  title: string = "";
  message: string = "";
  type: NotificationType = "info";
  createdAt: Date = new Date();
  expiresAt: Date = new Date(Date.now() + MILLISECONDS_PER_DAY);
  readBy: string[] = [];

  static async send(
    db: Db,
    recipient: string | null,
    input: NotificationInput,
  ): Promise<void> {
    const model = new NotificationDbModel();
    model.recipient = recipient;
    model.title = input.title;
    model.message = input.message;
    model.type = input.type;
    await db.collection<NotificationDbModel>(COLLECTION_NAME).insertOne(model);
  }

  static async findForUser(
    db: Db,
    username: string,
  ): Promise<NotificationDbModel[]> {
    return db
      .collection<NotificationDbModel>(COLLECTION_NAME)
      .find({ $or: [{ recipient: username }, { recipient: null }] })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async markRead(
    db: Db,
    id: string,
    username: string,
  ): Promise<boolean> {
    const result = await db
      .collection<NotificationDbModel>(COLLECTION_NAME)
      .updateOne({ id }, { $addToSet: { readBy: username } });
    return result.matchedCount > 0;
  }

  static async deleteById(db: Db, id: string): Promise<boolean> {
    const result = await db
      .collection<NotificationDbModel>(COLLECTION_NAME)
      .deleteOne({ id });
    return result.deletedCount > 0;
  }
}

export async function init(db: Db): Promise<void> {
  const collection = db.collection(COLLECTION_NAME);
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await collection.createIndex({ recipient: 1 });
  await collection.createIndex({ createdAt: -1 });
}
