/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { ConfigGetSchema } from "../../types/api/config.js";
import { getConfig } from "../../utils/configService.js";

export default class ConfigGetRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/config";
  schema = ConfigGetSchema;
  requiresAuth = true;

  handler = async (_request: any, response: any) => {
    const db = this.getDatabase();
    const config = await getConfig(db);
    response.send(config);
  };
}
