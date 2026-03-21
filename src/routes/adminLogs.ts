/*
 * Created on Mon Mar 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { readFile, readdir } from "fs/promises";
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

    try {
      const latestLogFile = (await readdir("logs")).reduce<{
        fileName: string;
        index: number;
      } | null>((latestFile, fileName) => {
        const match = fileName.match(
          new RegExp(`^${logId}\\.${date}\\.(\\d+)\\.log$`),
        );

        if (!match) {
          return latestFile;
        }

        const candidateFile = {
          fileName,
          index: Number(match[1]),
        };

        if (!latestFile || candidateFile.index > latestFile.index) {
          return candidateFile;
        }

        return latestFile;
      }, null);

      if (!latestLogFile) {
        response.status(404).send({ error: "Log file not found" });
        return;
      }

      const filePath = join("logs", latestLogFile.fileName);
      const logContent = await readFile(filePath, "utf-8");
      response.type("text/plain").send(logContent);
    } catch (error) {
      response.status(404).send({ error: "Log file not found" });
    }
  };
}
