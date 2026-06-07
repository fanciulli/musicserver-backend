/*
 * Created on Fri May 15 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { DbAlbumsSchema } from "../../types/api/dbSummary.js";
import { ArtistDbModel } from "../../types/db/artist.js";
import { AlbumDbModel } from "../../types/db/album.js";

export default class DbAlbumsRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/db/artists/:artistId/albums";
  schema = DbAlbumsSchema;
  requiresAuth = true;
  handler = async (request: any, response: any) => {
    const { artistId } = request.params;
    const db = this.getDatabase();

    const artist = await ArtistDbModel.findById(db, artistId);
    if (!artist) {
      response.status(404).send();
      return;
    }

    const albums = await AlbumDbModel.findAlbumsByArtistId(db, artistId);
    response.send(albums);
  };
}
