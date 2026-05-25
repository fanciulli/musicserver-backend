/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { ApiKeyCreateSchema } from "../../types/api/apiKeys.js";
import { ApiKeyDbModel } from "../../types/db/apiKey.js";
import { generateApiKey } from "../../utils/apiKeyUtils.js";
import type { Context } from "../../types/context.js";

export default class ApiKeysCreate extends Route {
  method = HttpMethods.POST;
  url = "/admin/api-keys";
  schema = ApiKeyCreateSchema;
  requiresAuth = true;

  constructor(context: Context) {
    super(context);
  }

  handler = async (request: any, response: any) => {
    const { name, durationDays } = request.body as {
      name: string;
      durationDays: number | null;
    };

    const { key, prefix, hash } = generateApiKey();

    const model = new ApiKeyDbModel();
    model.name = name;
    model.keyHash = hash;
    model.keyPrefix = prefix;
    model.createdAt = new Date();
    model.expiresAt =
      durationDays !== null
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

    await model.insert(this.getDatabase());

    response.send({
      id: model.id,
      name: model.name,
      key,
      createdAt: model.createdAt.toISOString(),
      expiresAt: model.expiresAt ? model.expiresAt.toISOString() : null,
    });
  };
}
