/*
 * Created on Mon Mar 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { readFile } from "fs/promises";
import { join } from "path";
import { Route } from "../types/route.js";
import { HttpMethods } from "../misc/constants.js";
import { AdminLogsSchema } from "../types/api/adminLogs.js";

export class AdminLogsRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/logs";
  schema = AdminLogsSchema;
  handler = async (request: any, response: any) => {
    const logId = request.query.id;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const date = `${year}-${month}-${day}`;

    const fileName = `${logId}.${date}.1.log`;
    const filePath = join("logs", fileName);

    try {
      const logContent = await readFile(filePath, "utf-8");
      response.type("text/plain").send(logContent);
    } catch (error) {
      response.status(404).send({ error: "Log file not found" });
    }
  };
}
