/*
 * Created on Fri May 15 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { DbSongsSchema } from "../../types/api/dbSummary.js";
import { AlbumDbModel } from "../../types/db/album.js";
import { SongDbModel } from "../../types/db/song.js";

export default class DbSongsRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/db/albums/:albumId/songs";
  schema = DbSongsSchema;
  handler = async (request: any, response: any) => {
    const { albumId } = request.params;
    const db = this.getContext().database;

    const album = await AlbumDbModel.findByIdAcrossPlugins(db, albumId);
    if (!album) {
      response.status(404).send();
      return;
    }

    const songs = await SongDbModel.findSongsByAlbumIdAllPlugins(db, albumId);
    response.send(songs);
  };
}
