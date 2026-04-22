/*
 * Created on Fri Apr 18 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it, vi } from "vitest";
import { default as HealthzRoute } from "../../src/routes/healthz.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("HealthzRoute", () => {
  it("has correct URL", () => {
    const route = new HealthzRoute();
    expect(route.url).toBe("/healthz");
  });

  it("responds with status 200 and OK message", async () => {
    const route = new HealthzRoute();
    const response = createResponseMock();

    await route.handler({}, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith({ status: "OK" });
  });
});
