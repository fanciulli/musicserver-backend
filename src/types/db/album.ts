/*
 * Created on Sat Feb 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";

const COLLECTION_NAME = "albums";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class AlbumDbModel {
  id: string = "";
  name: string = "";
  pluginId: string = "";
  artists: string[] = [];
  cover?: string = undefined;
  exists?: boolean;

  static fromJson(json: Partial<AlbumDbModel>): AlbumDbModel {
    const album = new AlbumDbModel();
    album.id = json.id ?? "";
    album.name = json.name ?? "";
    album.pluginId = json.pluginId ?? "";
    album.artists = json.artists ?? [];
    album.cover = json.cover;
    album.exists = json.exists;
    return album;
  }

  static async deleteAll(db: Db, pluginId: string) {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    await collection.deleteMany({ pluginId: pluginId });
  }

  static async markAllAsNotExisting(db: Db, pluginId: string): Promise<void> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    await collection.updateMany(
      { pluginId: pluginId },
      { $set: { exists: false } },
    );
  }

  static async deleteNotExisting(db: Db, pluginId: string): Promise<void> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    await collection.deleteMany({ pluginId: pluginId, exists: false });
  }

  static async find(
    db: Db,
    name: string,
    pluginId: string,
    artists: string[] = [],
  ): Promise<AlbumDbModel | undefined> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    const query: Record<string, unknown> = {
      name: name,
      pluginId: pluginId,
    };

    if (artists.length > 0) {
      query.artists = { $all: artists };
    }

    const album = await collection.findOne(query, {
      projection: {
        cover: 0,
      },
    });

    return album ? AlbumDbModel.fromJson(album) : undefined;
  }

  static async findById(db: Db, id: string): Promise<AlbumDbModel | undefined> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    const album = await collection.findOne(
      {
        id: id,
      },
      {
        projection: {
          cover: 0,
        },
      },
    );

    return album ? AlbumDbModel.fromJson(album) : undefined;
  }

  static async findCoverById(db: Db, id: string): Promise<string | undefined> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    const album = await collection.findOne(
      {
        id: id,
      },
      {
        projection: {
          cover: 1,
          _id: 0,
        },
      },
    );

    return album?.cover;
  }

  static async updateCoverById(
    db: Db,
    id: string,
    cover: string,
  ): Promise<void> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    await collection.updateOne(
      { id: id },
      { $set: { cover: cover } },
      { ignoreUndefined: true },
    );
  }

  async insert(db: Db): Promise<void> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    await collection.insertOne(this, { ignoreUndefined: true });
  }

  async update(db: Db): Promise<void> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    await collection.updateOne(
      { id: this.id },
      { $set: this },
      { ignoreUndefined: true },
    );
  }

  static async findAlbumsByPluginId(
    db: Db,
    pluginId: string,
  ): Promise<Array<AlbumDbModel>> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    const albums = await collection
      .find({
        pluginId: pluginId,
      })
      .toArray();

    return albums.map((album) => AlbumDbModel.fromJson(album));
  }

  static async findAlbumsByStartingLetter(
    db: Db,
    pluginId: string,
    letter: string,
  ): Promise<Array<AlbumDbModel>> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    const albums = await collection
      .find({
        pluginId: pluginId,
        name: { $regex: `^${letter}.*`, $options: "i" },
      })
      .toArray();

    return albums.map((album) => AlbumDbModel.fromJson(album));
  }

  static async findAlbumsByArtistIdAndPluginId(
    db: Db,
    pluginId: string,
    artistId: string,
  ): Promise<Array<AlbumDbModel>> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    const albums = await collection
      .find({
        pluginId: pluginId,
        artists: artistId,
      })
      .toArray();

    return albums.map((album) => AlbumDbModel.fromJson(album));
  }

  static async findAlbumsByQuery(
    db: Db,
    pluginId: string,
    query: string,
  ): Promise<Array<AlbumDbModel>> {
    const normalizedQuery = query.trim();
    if (normalizedQuery === "") {
      return [];
    }

    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    const albums = await collection
      .find({
        pluginId: pluginId,
        name: { $regex: escapeRegex(normalizedQuery), $options: "i" },
      })
      .toArray();

    return albums.map((album) => AlbumDbModel.fromJson(album));
  }

  static async count(db: Db): Promise<number> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    return collection.countDocuments();
  }

  static async findAlbumsByArtistId(
    db: Db,
    artistId: string,
  ): Promise<Array<AlbumDbModel>> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    const albums = await collection
      .find({ artists: artistId })
      .toArray();
    return albums.map((album) => AlbumDbModel.fromJson(album));
  }

  static async findByIdAcrossPlugins(
    db: Db,
    id: string,
  ): Promise<AlbumDbModel | undefined> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);
    const album = await collection.findOne(
      { id: id },
      { projection: { cover: 0 } },
    );
    return album ? AlbumDbModel.fromJson(album) : undefined;
  }
}

export function init(db: Db): void {}
