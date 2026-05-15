/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { HttpMethods } from "../misc/constants.js";
import type { Context } from "./context.js";

export interface IRoute {
  method: HttpMethods;
  url: String;
  handler: (request: any, response: any) => any;
}

export abstract class Route implements IRoute {
  #context: Context;
  method: HttpMethods = HttpMethods.GET;
  schema: object = {};
  abstract url: String;
  abstract handler: (request: any, response: any) => any;

  constructor(context: Context) {
    this.#context = context;
  }

  protected getContext(): Context {
    if (!this.#context) {
      throw new Error("Context is required for this route");
    }

    return this.#context;
  }

  protected getDatabase() {
    return this.getContext().database;
  }
}
