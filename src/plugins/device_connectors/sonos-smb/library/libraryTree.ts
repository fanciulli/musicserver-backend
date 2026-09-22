/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Db } from "mongodb";
import type { Context } from "../../../../types/context.js";
import { ArtistDbModel } from "../../../../types/db/artist.js";
import { AlbumDbModel } from "../../../../types/db/album.js";
import { SongDbModel } from "../../../../types/db/song.js";
import { dedupe, songFileName } from "./naming.js";
import { DEFAULT_COVER_JPEG } from "./defaultCover.js";
import { getStartedAlbumArtPlugin } from "../../../../utils/albumArtPluginResolver.js";

export interface LibNode {
  kind: "root" | "artist" | "album" | "song" | "cover";
  name: string;
  id?: string;
  filePath?: string;
  /** Id of the MusicSourcePlugin that owns this song, for plugin-backed streaming. */
  pluginId?: string;
}

const ROOT_NODE: LibNode = { kind: "root", name: "" };

/**
 * Conventional cover-art file names a client may request inside an album
 * directory (Sonos opens `folder.jpg`). Matched case-insensitively.
 */
const COVER_FILENAMES = new Set(["folder.jpg", "cover.jpg"]);

function isCoverFilename(segment: string): boolean {
  return COVER_FILENAMES.has(segment.toLowerCase());
}

/**
 * Mongo-backed artist -> album -> song tree, exposing children listing and
 * path resolution used by the SMB directory/file handlers.
 */
export class LibraryTree {
  private readonly db: Db;

  constructor(private readonly context: Context) {
    this.db = context.database;
  }

  async listChildren(node: LibNode): Promise<LibNode[]> {
    switch (node.kind) {
      case "root":
        return this.listArtists();
      case "artist":
        return this.listAlbums(node);
      case "album":
        return this.listSongs(node);
      case "song":
      case "cover":
        return [];
    }
  }

  /**
   * Cover-art bytes for an album (folder.jpg). Returns the stored cover when
   * present, otherwise the application's default album art (as JPEG) — Sonos
   * refuses to start playback when folder.jpg cannot be opened, so a cover is
   * always served.
   */
  async getCover(albumId: string): Promise<Buffer> {
    const albumArtPlugin = await getStartedAlbumArtPlugin(this.context);
    if (albumArtPlugin) {
      const art = await albumArtPlugin.getArt(albumId, "album");
      if (art) {
        return Buffer.from(art);
      }
    }
    return DEFAULT_COVER_JPEG;
  }

  private async listArtists(): Promise<LibNode[]> {
    const artists = await ArtistDbModel.findAll(this.db);
    return artists.map((artist) => ({
      kind: "artist" as const,
      name: artist.name ?? "",
      id: artist.id,
    }));
  }

  private async listAlbums(artistNode: LibNode): Promise<LibNode[]> {
    if (artistNode.id === undefined) {
      return [];
    }
    const albums = await AlbumDbModel.findAlbumsByArtistId(
      this.db,
      artistNode.id,
    );
    return albums.map((album) => ({
      kind: "album" as const,
      name: album.name ?? "",
      id: album.id,
    }));
  }

  private async listSongs(albumNode: LibNode): Promise<LibNode[]> {
    if (albumNode.id === undefined) {
      return [];
    }
    const songs = await SongDbModel.findSongsByAlbumId(this.db, albumNode.id);
    const names = dedupe(
      songs.map((song) =>
        songFileName({
          name: song.name,
          trackNumber: song.trackNumber,
          diskNumber: song.diskNumber,
          filePath: song.metadata?.filePath ?? "",
        }),
      ),
    );
    return songs.map((song, index) => ({
      kind: "song" as const,
      name: names[index],
      id: song.id,
      filePath: song.metadata?.filePath,
      pluginId: song.pluginId,
    }));
  }

  async resolve(segments: string[]): Promise<LibNode | null> {
    let current: LibNode = ROOT_NODE;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // A cover-art file (e.g. folder.jpg) is a virtual leaf inside an album
      // directory; it is not enumerated but can be opened by name. Existence
      // (whether the album actually has a cover) is checked when it is opened.
      if (
        current.kind === "album" &&
        i === segments.length - 1 &&
        isCoverFilename(segment)
      ) {
        return { kind: "cover", name: segment, id: current.id };
      }

      const children = await this.listChildren(current);
      const match = children.find(
        (child) => child.name.toLowerCase() === segment.toLowerCase(),
      );
      if (match === undefined) {
        return null;
      }
      current = match;
    }
    return current;
  }
}
