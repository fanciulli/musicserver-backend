/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { NotificationReadSchema } from "../../types/api/notifications.js";
import { NotificationDbModel } from "../../types/db/notification.js";

export default class NotificationRead extends Route {
  method = HttpMethods.POST;
  url = "/admin/notifications/:id/read";
  schema = NotificationReadSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const username = request.username as string;
    const updated = await NotificationDbModel.markRead(
      this.getDatabase(),
      request.params.id,
      username,
    );

    if (!updated) {
      response.code(404).send();
      return;
    }

    response.send();
  };
}
