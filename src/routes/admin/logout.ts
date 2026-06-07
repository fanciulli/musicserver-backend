import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { UserSessionDbModel } from "../../types/db/userSession.js";
import type { Context } from "../../types/context.js";

export default class LogoutRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/logout";
  requiresAuth = true;
  schema = {};

  handler = async (request: any, response: any) => {
    const username: string = (request as any).username;
    const db = this.getDatabase();
    await UserSessionDbModel.deleteByUsername(db, username);
    return response.send({ success: true });
  };
}
