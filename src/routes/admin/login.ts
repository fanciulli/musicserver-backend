import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { UserPasswordDbModel } from "../../types/db/userPassword.js";
import { UserSessionDbModel } from "../../types/db/userSession.js";
import {
  verifyPassword,
  generateSessionToken,
  hashToken,
} from "../../utils/sessionAuthUtils.js";
import {
  isRateLimited,
  recordFailedAttempt,
  resetAttempts,
} from "../../utils/loginRateLimiter.js";
import {
  LoginRequestSchema,
  type LoginRequest,
  type LoginResponse,
} from "../../types/api/login.js";

export default class LoginRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/login";
  requiresAuth = false;
  schema = LoginRequestSchema;

  handler = async (request: any, response: any) => {
    const ip: string = request.ip ?? "unknown";

    if (isRateLimited(ip)) {
      return response.code(429).send();
    }

    const { username, password } = request.body as LoginRequest;
    const db = this.getDatabase();

    const user = await UserPasswordDbModel.findByUsername(db, username);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordFailedAttempt(ip);
      return response.code(401).send();
    }

    resetAttempts(ip);
    await UserSessionDbModel.deleteByUsername(db, username);

    const token = generateSessionToken(username);
    const session = new UserSessionDbModel();
    session.username = username;
    session.tokenHash = hashToken(token);
    await session.insert(db);

    const respondeBody: LoginResponse = {
      token,
      expiresAt: session.expiresAt.toISOString(),
    };
    return response.send(respondeBody);
  };
}
