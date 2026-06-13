/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { NotificationsListSchema } from "../../types/api/notifications.js";
import { NotificationDbModel } from "../../types/db/notification.js";

export default class NotificationsList extends Route {
  method = HttpMethods.GET;
  url = "/admin/notifications";
  schema = NotificationsListSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const username = this.getUsername(request);
    const notifications = await NotificationDbModel.findForUser(
      this.getDatabase(),
      username,
    );

    const result = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      createdAt:
        n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
      read: Array.isArray(n.readBy) && n.readBy.includes(username),
    }));

    response.send(result);
  };
}
