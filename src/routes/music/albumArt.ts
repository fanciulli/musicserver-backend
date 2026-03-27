/*
 * Created on Fri Mar 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpHeaders, HttpMethods, MimeTypes } from "../../misc/constants.js";
import { AlbumArtSchema } from "../../types/api/albumArt.js";
import { getPluginById } from "../../utils/musicSourcePluginResolver.js";
import { extractPluginId } from "../../utils/pathUtils.js";

export default class AlbumArtRoute extends Route {
  method = HttpMethods.GET;
  url = "/music/albumart";
  schema = AlbumArtSchema;
  handler = async (request: any, response: any) => {
    const uri = request.query.id;
    const pluginId = extractPluginId(uri);
    const pluginResult = await getPluginById(pluginId);
    if (pluginResult.error) {
      response
        .status(pluginResult.error.status)
        .send({ error: pluginResult.error.message });
      return;
    }

    try {
      const plugin = pluginResult.plugin;
      const stream = await plugin.getAlbumArt(uri);
      response.header(
        HttpHeaders.CONTENT_TYPE,
        MimeTypes.APPLICATION_OCTET_STREAM,
      );
      return response.send(stream);
    } catch (error) {
      response.status(404).send({ error: "Album art not found" });
    }
  };
}
