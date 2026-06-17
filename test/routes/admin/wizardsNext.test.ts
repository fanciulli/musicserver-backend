import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  listWizardFiles: vi.fn(),
  loadWizard: vi.fn(),
  hasBeenShown: vi.fn(),
  markShown: vi.fn(),
}));

vi.mock("../../../src/utils/wizardLoader.js", () => ({
  listWizardFiles: (...args: unknown[]) => mocks.listWizardFiles(...args),
  loadWizard: (...args: unknown[]) => mocks.loadWizard(...args),
}));

vi.mock("../../../src/types/db/wizardView.js", () => ({
  WizardViewDbModel: {
    hasBeenShown: (...args: unknown[]) => mocks.hasBeenShown(...args),
    markShown: (...args: unknown[]) => mocks.markShown(...args),
  },
}));

import WizardsNext from "../../../src/routes/admin/wizardsNext.js";
import { HttpMethods } from "../../../src/misc/constants.js";

function createRoute() {
  return new WizardsNext({ database: {} } as any);
}

function createRequest(username = "alice") {
  return { username } as any;
}

function createResponse() {
  const response: any = {};
  response.send = vi.fn().mockReturnValue(response);
  response.code = vi.fn().mockReturnValue(response);
  return response;
}

describe("WizardsNext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasBeenShown.mockResolvedValue(false);
    mocks.markShown.mockResolvedValue(true);
  });

  it("has correct url, method and auth", () => {
    const route = createRoute();
    expect(route.url).toBe("/admin/wizards/next");
    expect(route.method).toBe(HttpMethods.GET);
    expect(route.requiresAuth).toBe(true);
  });

  it("responds 204 when there are no wizard files", async () => {
    mocks.listWizardFiles.mockResolvedValue([]);
    const response = createResponse();

    await createRoute().handler(createRequest(), response);

    expect(response.code).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledWith();
  });

  it("serves the first wizard that has not been shown and marks it", async () => {
    mocks.listWizardFiles.mockResolvedValue(["/w/0001.json", "/w/0002.json"]);
    mocks.loadWizard.mockImplementation(async (file: string) =>
      file === "/w/0001.json"
        ? { id: "first", steps: [{ image: "a.svg", text: "a" }] }
        : { id: "second", steps: [{ image: "b.svg", text: "b" }] },
    );
    mocks.hasBeenShown.mockImplementation(
      async (_db: unknown, _user: string, id: string) => id === "first",
    );
    const response = createResponse();

    await createRoute().handler(createRequest(), response);

    expect(mocks.markShown).toHaveBeenCalledWith({}, "alice", "second");
    expect(response.send).toHaveBeenCalledWith({
      id: "second",
      steps: [{ image: "b.svg", text: "b" }],
    });
  });

  it("responds 204 when every wizard has already been shown", async () => {
    mocks.listWizardFiles.mockResolvedValue(["/w/0001.json"]);
    mocks.loadWizard.mockResolvedValue({ id: "first", steps: [] });
    mocks.hasBeenShown.mockResolvedValue(true);
    const response = createResponse();

    await createRoute().handler(createRequest(), response);

    expect(mocks.markShown).not.toHaveBeenCalled();
    expect(response.code).toHaveBeenCalledWith(204);
  });

  it("skips malformed wizard files", async () => {
    mocks.listWizardFiles.mockResolvedValue(["/w/bad.json", "/w/0002.json"]);
    mocks.loadWizard.mockImplementation(async (file: string) =>
      file === "/w/bad.json"
        ? undefined
        : { id: "second", steps: [{ image: "b.svg", text: "b" }] },
    );
    const response = createResponse();

    await createRoute().handler(createRequest(), response);

    expect(response.send).toHaveBeenCalledWith({
      id: "second",
      steps: [{ image: "b.svg", text: "b" }],
    });
  });

  it("skips a wizard when a concurrent request claimed it first", async () => {
    mocks.listWizardFiles.mockResolvedValue(["/w/0001.json", "/w/0002.json"]);
    mocks.loadWizard.mockImplementation(async (file: string) =>
      file === "/w/0001.json"
        ? { id: "first", steps: [] }
        : { id: "second", steps: [{ image: "b.svg", text: "b" }] },
    );
    mocks.markShown.mockImplementation(
      async (_db: unknown, _user: string, id: string) => id !== "first",
    );
    const response = createResponse();

    await createRoute().handler(createRequest(), response);

    expect(response.send).toHaveBeenCalledWith({
      id: "second",
      steps: [{ image: "b.svg", text: "b" }],
    });
  });

  it("serves a single-step wizard as-is", async () => {
    mocks.listWizardFiles.mockResolvedValue(["/w/0001.json"]);
    mocks.loadWizard.mockResolvedValue({
      id: "solo",
      steps: [{ image: "a.svg", text: "only step" }],
    });
    const response = createResponse();

    await createRoute().handler(createRequest(), response);

    expect(response.send).toHaveBeenCalledWith({
      id: "solo",
      steps: [{ image: "a.svg", text: "only step" }],
    });
  });

  it("serves two wizards one after the other across calls", async () => {
    mocks.listWizardFiles.mockResolvedValue(["/w/0001.json", "/w/0002.json"]);
    mocks.loadWizard.mockImplementation(async (file: string) =>
      file === "/w/0001.json"
        ? { id: "first", steps: [{ image: "a.svg", text: "a" }] }
        : { id: "second", steps: [{ image: "b.svg", text: "b" }] },
    );

    // Track shown wizards so the mocks behave like the real persistence
    // layer across the two sequential requests.
    const shown = new Set<string>();
    mocks.hasBeenShown.mockImplementation(
      async (_db: unknown, _user: string, id: string) => shown.has(id),
    );
    mocks.markShown.mockImplementation(
      async (_db: unknown, _user: string, id: string) => {
        if (shown.has(id)) {
          return false;
        }
        shown.add(id);
        return true;
      },
    );

    const firstResponse = createResponse();
    await createRoute().handler(createRequest(), firstResponse);
    expect(firstResponse.send).toHaveBeenCalledWith({
      id: "first",
      steps: [{ image: "a.svg", text: "a" }],
    });

    const secondResponse = createResponse();
    await createRoute().handler(createRequest(), secondResponse);
    expect(secondResponse.send).toHaveBeenCalledWith({
      id: "second",
      steps: [{ image: "b.svg", text: "b" }],
    });
  });
});
