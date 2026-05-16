/*
 * Created on Fri May 15 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { DbArtistsSchema } from "../../types/api/dbSummary.js";
import { ArtistDbModel } from "../../types/db/artist.js";

export default class DbArtistsRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/db/artists";
  schema = DbArtistsSchema;
  handler = async (_request: any, response: any) => {
    const db = this.getDatabase();
    const artists = await ArtistDbModel.findAll(db);
    response.send(artists);
  };
}
