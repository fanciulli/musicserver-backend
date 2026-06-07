/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods, MILLISECONDS_PER_DAY } from "../../misc/constants.js";
import {
  ApiKeyCreateSchema,
  type ApiKeyCreateRequest,
  type ApiKeyCreateResponse,
} from "../../types/api/apiKeys.js";
import { ApiKeyDbModel } from "../../types/db/apiKey.js";
import { generateApiKey } from "../../utils/apiKeyUtils.js";

export default class ApiKeysCreate extends Route {
  method = HttpMethods.POST;
  url = "/admin/api-keys";
  schema = ApiKeyCreateSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const { name, durationDays } = request.body as ApiKeyCreateRequest;

    const { key, prefix, hash } = generateApiKey();

    const model = new ApiKeyDbModel();
    model.name = name;
    model.keyHash = hash;
    model.keyPrefix = prefix;
    model.createdAt = new Date();
    model.expiresAt =
      durationDays !== null
        ? new Date(Date.now() + durationDays * MILLISECONDS_PER_DAY)
        : null;

    await model.insert(this.getDatabase());

    const responseBody = {
      id: model.id,
      name: model.name,
      key,
      createdAt: model.createdAt.toISOString(),
      expiresAt: model.expiresAt ? model.expiresAt.toISOString() : null,
    } as ApiKeyCreateResponse;

    response.send(responseBody);
  };
}
