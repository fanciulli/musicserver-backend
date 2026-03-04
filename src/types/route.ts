/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { HttpMethods } from "../misc/constants.js";

export interface IRoute {
  method: HttpMethods;
  url: String;
  handler: (request: any, response: any) => any;
}

export abstract class Route implements IRoute {
  method: HttpMethods = HttpMethods.GET;
  schema: object = {};
  abstract url: String;
  abstract handler: (request: any, response: any) => any;
}
