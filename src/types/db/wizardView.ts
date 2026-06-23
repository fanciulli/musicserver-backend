/*
 * Created on Tue Jun 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Db } from "mongodb";
import { v4 } from "uuid";

const COLLECTION_NAME = "wizards";

export class WizardViewDbModel {
  id: string = v4();
  username: string = "";
  wizardId: string = "";
  shownAt: Date = new Date();

  static async hasBeenShown(
    db: Db,
    username: string,
    wizardId: string,
  ): Promise<boolean> {
    const doc = await db
      .collection<WizardViewDbModel>(COLLECTION_NAME)
      .findOne({ username, wizardId });
    return doc !== null;
  }

  /**
   * Atomically records that the wizard has been shown to the user.
   * Returns true only when this call created the entry, false when the
   * entry already existed (e.g. a concurrent request claimed it first).
   */
  static async markShown(
    db: Db,
    username: string,
    wizardId: string,
  ): Promise<boolean> {
    const result = await db
      .collection<WizardViewDbModel>(COLLECTION_NAME)
      .updateOne(
        { username, wizardId },
        {
          $setOnInsert: {
            id: v4(),
            username,
            wizardId,
            shownAt: new Date(),
          },
        },
        { upsert: true },
      );
    return result.upsertedCount === 1;
  }
}

export async function init(db: Db): Promise<void> {
  const collection = db.collection(COLLECTION_NAME);
  await collection.createIndex({ username: 1, wizardId: 1 }, { unique: true });
}
