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
import type { Context } from "../../types/context.js";

export default class ApiKeysDelete extends Route {
  method = HttpMethods.DELETE;
  url = "/admin/api-keys/:id";
  schema = ApiKeyDeleteSchema;
  requiresAuth = true;

  constructor(context: Context) {
    super(context);
  }

  handler = async (request: any, response: any) => {
    const { id } = request.params as { id: string };
    const deleted = await ApiKeyDbModel.deleteById(this.getDatabase(), id);

    if (!deleted) {
      response.code(404).send({ error: "API key not found" });
      return;
    }

    response.send({ status: "ok" });
  };
}
