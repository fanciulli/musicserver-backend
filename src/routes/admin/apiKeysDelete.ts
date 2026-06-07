/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { ApiKeyDeleteSchema } from "../../types/api/apiKeys.js";
import { ApiKeyDbModel } from "../../types/db/apiKey.js";

export default class ApiKeysDelete extends Route {
  method = HttpMethods.DELETE;
  url = "/admin/api-keys/:id";
  schema = ApiKeyDeleteSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const deleted = await ApiKeyDbModel.deleteById(
      this.getDatabase(),
      request.params.id,
    );

    if (!deleted) {
      response.code(404).send();
      return;
    }

    response.send();
  };
}
