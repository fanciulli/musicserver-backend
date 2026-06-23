/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { ConfigUpdateSchema } from "../../types/api/config.js";
import { updateConfig } from "../../utils/configService.js";

export default class ConfigUpdateRoute extends Route {
  method = HttpMethods.PUT;
  url = "/admin/config";
  schema = ConfigUpdateSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const db = this.getDatabase();
    const values = (request.body?.values ?? {}) as Record<string, unknown>;

    const result = await updateConfig(db, values);
    if ("error" in result) {
      response.status(400).send({ error: result.error });
      return;
    }

    response.send(result);
  };
}
