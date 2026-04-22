/*
 * Created on Fri Mar 05 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { BrowseResponse, BrowseType } from "../types/api/browse.js";
import { Folder } from "../types/api/folder.js";
import { AlbumDbModel } from "../types/db/album.js";
import { ArtistDbModel } from "../types/db/artist.js";
import { Song } from "../types/api/song.js";
import { SongDbModel } from "../types/db/song.js";

export class BrowseUtils {
  static createAlbumsFolderResponses(
    pathPrefix: string,
    albums: AlbumDbModel[],
  ): BrowseResponse[] {
    const resp: BrowseResponse[] = [];

    for (let album of albums) {
      const folder = new Folder();
      folder.name = album.name;

      resp.push(
        new BrowseResponse(
          `${pathPrefix}/${album.id}`,
          BrowseType.FOLDER,
          folder,
        ),
      );
    }

    return resp;
  }

  static createArtistsFolderResponses(
    pathPrefix: string,
    artists: ArtistDbModel[],
  ): BrowseResponse[] {
    const resp: BrowseResponse[] = [];

    for (let artist of artists) {
      const folder = new Folder();
      folder.name = artist.name;

      resp.push(
        new BrowseResponse(
          `${pathPrefix}/${artist.id}`,
          BrowseType.FOLDER,
          folder,
        ),
      );
    }

    return resp;
  }

  static createSongsBrowseResponses(
    pathPrefix: string,
    songs: SongDbModel[],
  ): BrowseResponse[] {
    const resp: BrowseResponse[] = [];

    for (let song of songs) {
      const data = Song.fromDbModel(song);

      resp.push(
        new BrowseResponse(`${pathPrefix}/${song.id}`, BrowseType.SONG, data),
      );
    }

    return resp;
  }
}
