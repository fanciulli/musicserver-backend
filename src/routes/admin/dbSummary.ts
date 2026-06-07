/*
 * Created on Fri May 15 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { DbSummarySchema } from "../../types/api/dbSummary.js";
import { ArtistDbModel } from "../../types/db/artist.js";
import { AlbumDbModel } from "../../types/db/album.js";
import { SongDbModel } from "../../types/db/song.js";

export default class DbSummaryRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/db/summary";
  schema = DbSummarySchema;
  requiresAuth = true;
  handler = async (_request: any, response: any) => {
    const db = this.getDatabase();

    const [artists, albums, songs] = await Promise.all([
      ArtistDbModel.count(db),
      AlbumDbModel.count(db),
      SongDbModel.count(db),
    ]);

    response.send({ artists, albums, songs });
  };
}
