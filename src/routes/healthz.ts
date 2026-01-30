/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route";

const healthzHandler = async (request: any, reply: any) => {
  reply.status(200).send({ status: "OK" });
};

export class HealthzRoute extends Route {
  url = '/healthz';
  schema = undefined;
  handler = healthzHandler;
}