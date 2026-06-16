import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  getWizardImagesFolder: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mocks.readFile(...args),
}));

vi.mock("../../../src/utils/wizardLoader.js", () => ({
  getWizardImagesFolder: () => mocks.getWizardImagesFolder(),
}));

import WizardImage from "../../../src/routes/admin/wizardImage.js";
import { HttpHeaders, HttpMethods } from "../../../src/misc/constants.js";

const IMAGES_FOLDER = "/app/wizards/images";

function createRoute() {
  return new WizardImage({ database: {} } as any);
}

function createResponse() {
  const response: any = {};
  response.send = vi.fn().mockReturnValue(response);
  response.code = vi.fn().mockReturnValue(response);
  response.header = vi.fn().mockReturnValue(response);
  return response;
}

describe("WizardImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWizardImagesFolder.mockReturnValue(IMAGES_FOLDER);
  });

  it("has correct url, method and auth", () => {
    const route = createRoute();
    expect(route.url).toBe("/admin/wizards/images/:filename");
    expect(route.method).toBe(HttpMethods.GET);
    expect(route.requiresAuth).toBe(true);
  });

  it("serves an existing png with the right content type", async () => {
    const buffer = Buffer.from("PNGDATA");
    mocks.readFile.mockResolvedValue(buffer);
    const response = createResponse();

    await createRoute().handler(
      { params: { filename: "welcome-step-1.png" } },
      response,
    );

    expect(mocks.readFile).toHaveBeenCalledWith(
      `${IMAGES_FOLDER}/welcome-step-1.png`,
    );
    expect(response.header).toHaveBeenCalledWith(
      HttpHeaders.CONTENT_TYPE,
      "image/png",
    );
    expect(response.send).toHaveBeenCalledWith(buffer);
  });

  it("serves an svg with the svg content type", async () => {
    mocks.readFile.mockResolvedValue(Buffer.from("<svg/>"));
    const response = createResponse();

    await createRoute().handler(
      { params: { filename: "welcome-step-1.svg" } },
      response,
    );

    expect(response.header).toHaveBeenCalledWith(
      HttpHeaders.CONTENT_TYPE,
      "image/svg+xml",
    );
  });

  it("falls back to octet-stream for unknown extensions", async () => {
    mocks.readFile.mockResolvedValue(Buffer.from("data"));
    const response = createResponse();

    await createRoute().handler(
      { params: { filename: "thing.bin" } },
      response,
    );

    expect(response.header).toHaveBeenCalledWith(
      HttpHeaders.CONTENT_TYPE,
      "application/octet-stream",
    );
  });

  it("returns 404 for path traversal attempts", async () => {
    const response = createResponse();

    await createRoute().handler(
      { params: { filename: "../../secret.key" } },
      response,
    );

    expect(response.code).toHaveBeenCalledWith(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("returns 404 when the file does not exist", async () => {
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));
    const response = createResponse();

    await createRoute().handler(
      { params: { filename: "missing.png" } },
      response,
    );

    expect(response.code).toHaveBeenCalledWith(404);
  });
});
