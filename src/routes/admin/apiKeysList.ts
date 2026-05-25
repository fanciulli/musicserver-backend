/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { ApiKeyListSchema } from "../../types/api/apiKeys.js";
import { ApiKeyDbModel } from "../../types/db/apiKey.js";
import type { Context } from "../../types/context.js";

export default class ApiKeysList extends Route {
  method = HttpMethods.GET;
  url = "/admin/api-keys";
  schema = ApiKeyListSchema;
  requiresAuth = true;

  constructor(context: Context) {
    super(context);
  }

  handler = async (_request: any, response: any) => {
    const keys = await ApiKeyDbModel.findAll(this.getDatabase());
    response.send(keys);
  };
}
