/*
 * Created on Wed Jan 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route";
import { HttpMethods } from "../misc/constants";

const browseHandler = async (request: any, response: any) => {
  response.send(401);
};

export class BrowseRoute extends Route {
  method = HttpMethods.POST;
  url = "/browse";
  schema = undefined;
  handler = browseHandler;
}