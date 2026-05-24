/*
 * Created on Mon Mar 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { AdminLogsSchema } from "../../types/api/adminLogs.js";
import { LogLineDbModel } from "../../types/db/logLine.js";

const VALID_LOG_IDS = new Set(["main", "fastify"]);

export default class AdminLogsRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/logs";
  schema = AdminLogsSchema;
  handler = async (request: any, response: any) => {
    const { id, level, from, to, page, limit } = request.query;
    const db = this.getDatabase();

    try {
      const result = await LogLineDbModel.query(db, {
        logId: id,
        level,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        page: page !== undefined ? Number(page) : undefined,
        limit: limit !== undefined ? Number(limit) : undefined,
      });
      response.send(result);
    } catch {
      response.status(500).send({ error: "Failed to retrieve logs" });
    }
  };
}
