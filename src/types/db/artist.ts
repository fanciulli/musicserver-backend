/*
 * Created on Mon Feb 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";

const COLLECTION_NAME = "artists";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class ArtistDbModel {
  id?: string;
  name?: string;
  pluginId?: string;
  exists?: boolean;

  static fromJson(json: Partial<ArtistDbModel>): ArtistDbModel {
    const artist = new ArtistDbModel();
    artist.id = json.id;
    artist.name = json.name;
    artist.pluginId = json.pluginId;
    artist.exists = json.exists;
    return artist;
  }

  static async find(
    db: Db,
    name: string,
    pluginId: string,
  ): Promise<ArtistDbModel | undefined> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const filter = {
      name: name,
      pluginId: pluginId,
    };
    const artist = await collection.findOne(filter);
    return artist ? ArtistDbModel.fromJson(artist) : undefined;
  }

  static async findCaseInsensitive(
    db: Db,
    name: string,
    pluginId: string,
  ): Promise<ArtistDbModel | undefined> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const filter = {
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
      pluginId: pluginId,
    };
    const artist = await collection.findOne(filter);
    return artist ? ArtistDbModel.fromJson(artist) : undefined;
  }

  static async findByIds(db: Db, ids: string[]): Promise<ArtistDbModel[]> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const filter = {
      id: { $in: ids },
    };
    const artists = await (await collection.find(filter)).toArray();
    return artists.map((artist) => ArtistDbModel.fromJson(artist));
  }

  static async findArtistsByPluginId(
    db: Db,
    pluginId: string,
  ): Promise<Array<ArtistDbModel>> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);

    const artists = await collection
      .find({
        pluginId: pluginId,
      })
      .toArray();

    return artists.map((artist) => ArtistDbModel.fromJson(artist));
  }

  static async findArtistsByStartingLetter(
    db: Db,
    pluginId: string,
    letter: string,
  ): Promise<Array<ArtistDbModel>> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);

    const artists = await collection
      .find({
        pluginId: pluginId,
        name: { $regex: `^${letter}.*`, $options: "i" },
      })
      .toArray();

    return artists.map((artist) => ArtistDbModel.fromJson(artist));
  }

  static async findArtistById(
    db: Db,
    pluginId: string,
    id: string,
  ): Promise<ArtistDbModel | undefined> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);

    const artist = await collection.findOne({
      id: id,
      pluginId: pluginId,
    });

    return artist ? ArtistDbModel.fromJson(artist) : undefined;
  }

  async insert(db: Db): Promise<void> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);

    await collection.insertOne(this);
  }

  async update(db: Db): Promise<void> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    await collection.updateOne(
      { id: this.id },
      { $set: this },
      { ignoreUndefined: true },
    );
  }

  static async deleteAll(db: Db, pluginId: string) {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);

    await collection.deleteMany({ pluginId: pluginId });
  }

  static async markAllAsNotExisting(db: Db, pluginId: string): Promise<void> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    await collection.updateMany({ pluginId: pluginId }, { $set: { exists: false } });
  }

  static async deleteNotExisting(db: Db, pluginId: string): Promise<void> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    await collection.deleteMany({ pluginId: pluginId, exists: false });
  }

  static async findArtistsByQuery(
    db: Db,
    pluginId: string,
    query: string,
  ): Promise<Array<ArtistDbModel>> {
    const normalizedQuery = query.trim();
    if (normalizedQuery === "") {
      return [];
    }

    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const artists = await collection
      .find({
        pluginId: pluginId,
        name: { $regex: escapeRegex(normalizedQuery), $options: "i" },
      })
      .toArray();

    return artists.map((artist) => ArtistDbModel.fromJson(artist));
  }

  static async count(db: Db): Promise<number> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    return collection.countDocuments();
  }

  static async findAll(db: Db): Promise<Array<ArtistDbModel>> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const artists = await collection
      .find({})
      .collation({ locale: "en", strength: 1 })
      .sort({ name: 1 })
      .toArray();
    return artists.map((artist) => ArtistDbModel.fromJson(artist));
  }

  static async findById(db: Db, id: string): Promise<ArtistDbModel | undefined> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const artist = await collection.findOne({ id: id });
    return artist ? ArtistDbModel.fromJson(artist) : undefined;
  }
}

export function init(db: Db): void {
  //db.collection(COLLECTION_NAME).createIndex()
}
