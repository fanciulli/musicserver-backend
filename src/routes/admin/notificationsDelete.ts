/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { NotificationDeleteSchema } from "../../types/api/notifications.js";
import { NotificationDbModel } from "../../types/db/notification.js";

export default class NotificationsDelete extends Route {
  method = HttpMethods.DELETE;
  url = "/admin/notifications/:id";
  schema = NotificationDeleteSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const deleted = await NotificationDbModel.deleteById(
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
