/*
 * Created on Tue Apr 07 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import {
  SearchSchema,
  type SearchRequestBody,
} from "../../types/api/search.js";
import {
  getPluginById,
  type PluginResolutionResult,
} from "../../utils/musicSourcePluginResolver.js";
import {
  MUSIC_SOURCE_PLUGIN_CATEGORY,
  type MusicSourcePlugin,
} from "../../types/plugins/music_sources.js";

export default class SearchRoute extends Route {
  method = HttpMethods.POST;
  url = "/music/search";
  schema = SearchSchema;
  handler = async (request: any, response: any) => {
    const body = request.body as SearchRequestBody;
    const plugins = await this.#resolvePlugins(response, body.scheme);
    if (plugins === undefined) {
      response
        .status(404)
        .send({ error: "Specified plugin not found or not searchable" });
      return;
    }

    const searchPromises = plugins.map((plugin) =>
      plugin.search(body.query, body.category),
    );
    const searchResults = await Promise.all(searchPromises);

    response.send(searchResults.flat());
  };

  async #resolvePlugins(
    response: any,
    scheme?: string,
  ): Promise<MusicSourcePlugin[] | undefined> {
    if (scheme) {
      const pluginResult: PluginResolutionResult = await getPluginById(
        scheme,
        this.getContext(),
      );

      if (pluginResult.plugin === undefined) {
        return undefined;
      } else {
        const plugin = pluginResult.plugin;
        return [plugin];
      }
    }

    const pluginManager = this.getContext().pluginManager;
    return pluginManager.getPluginsInCategory(
      MUSIC_SOURCE_PLUGIN_CATEGORY,
    ) as MusicSourcePlugin[];
  }
}
