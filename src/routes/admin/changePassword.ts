import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { UserPasswordDbModel } from "../../types/db/userPassword.js";
import { UserSessionDbModel } from "../../types/db/userSession.js";
import {
  verifyPassword,
  hashPassword,
} from "../../utils/sessionAuthUtils.js";
import type { Context } from "../../types/context.js";

export default class ChangePasswordRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/change-password";
  requiresAuth = true;
  schema = {
    body: {
      type: "object",
      required: ["currentPassword", "newPassword"],
      properties: {
        currentPassword: { type: "string" },
        newPassword: { type: "string" },
      },
    },
  };

  constructor(context: Context) {
    super(context);
  }

  handler = async (request: any, response: any) => {
    const username: string = (request as any).username;
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (newPassword.length < 8) {
      return response
        .code(400)
        .send({ error: "New password must be at least 8 characters" });
    }

    const db = this.getDatabase();
    const user = await UserPasswordDbModel.findByUsername(db, username);

    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return response.code(401).send({ error: "Invalid credentials" });
    }

    const newHash = await hashPassword(newPassword);
    await UserPasswordDbModel.updateHash(db, username, newHash);
    await UserSessionDbModel.deleteByUsername(db, username);

    return response.send({ success: true });
  };
}
