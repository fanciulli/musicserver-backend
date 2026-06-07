import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { UserPasswordDbModel } from "../../types/db/userPassword.js";
import { UserSessionDbModel } from "../../types/db/userSession.js";
import { verifyPassword, hashPassword } from "../../utils/sessionAuthUtils.js";
import {
  ChangePasswordRequestSchema,
  type ChangePasswordRequest,
} from "../../types/api/changePassword.js";

export default class ChangePasswordRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/change-password";
  requiresAuth = true;
  schema = ChangePasswordRequestSchema;

  handler = async (request: any, response: any) => {
    const username: string = (request as any).username;
    const { currentPassword, newPassword } =
      request.body as ChangePasswordRequest;

    const db = this.getDatabase();
    const user = await UserPasswordDbModel.findByUsername(db, username);

    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return response.code(401).send();
    }

    const newHash = await hashPassword(newPassword);
    await UserPasswordDbModel.updateHash(db, username, newHash);
    await UserSessionDbModel.deleteByUsername(db, username);

    return response.send();
  };
}
