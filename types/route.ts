import { HttpMethods } from "../misc/constants";

export interface IRoute {
    method: HttpMethods;
    url: String;
    handler: (request: any, response: any) => any;
}

abstract class Route implements IRoute {
    method: HttpMethods = HttpMethods.GET;
    abstract url: String;
    abstract handler: (request: any, response: any) => any;
}

export { Route };
