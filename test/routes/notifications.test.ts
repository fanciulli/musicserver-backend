import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findForUser: vi.fn(),
  markRead: vi.fn(),
  deleteById: vi.fn(),
}));

vi.mock("../../src/types/db/notification.js", () => ({
  NotificationDbModel: {
    findForUser: (...a: unknown[]) => mocks.findForUser(...a),
    markRead: (...a: unknown[]) => mocks.markRead(...a),
    deleteById: (...a: unknown[]) => mocks.deleteById(...a),
  },
  NOTIFICATION_TYPE_VALUES: ["info", "success", "warning", "error"],
}));

import { default as NotificationsList } from "../../src/routes/admin/notificationsList.js";
import { default as NotificationRead } from "../../src/routes/admin/notificationRead.js";
import { default as NotificationsDelete } from "../../src/routes/admin/notificationsDelete.js";

function createResponseMock() {
  return {
    code: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function createRouteContext() {
  return {
    database: "db-client",
    logger: { info: vi.fn(), error: vi.fn() },
  } as any;
}

describe("NotificationsList route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notifications for the current user with computed read flag", async () => {
    const createdAt = new Date("2026-06-13T10:00:00.000Z");
    mocks.findForUser.mockResolvedValue([
      {
        id: "n1",
        title: "T",
        message: "M",
        type: "info",
        createdAt,
        recipient: null,
        readBy: ["alice"],
        expiresAt: new Date(),
      },
      {
        id: "n2",
        title: "T2",
        message: "M2",
        type: "success",
        createdAt,
        recipient: "alice",
        readBy: [],
        expiresAt: new Date(),
      },
    ]);

    const route = new NotificationsList(createRouteContext());
    const response = createResponseMock();
    await route.handler({ username: "alice" }, response);

    expect(mocks.findForUser).toHaveBeenCalledWith("db-client", "alice");
    expect(response.send).toHaveBeenCalledWith([
      {
        id: "n1",
        title: "T",
        message: "M",
        type: "info",
        createdAt: "2026-06-13T10:00:00.000Z",
        read: true,
      },
      {
        id: "n2",
        title: "T2",
        message: "M2",
        type: "success",
        createdAt: "2026-06-13T10:00:00.000Z",
        read: false,
      },
    ]);
  });
});

describe("NotificationRead route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the notification read for the current user", async () => {
    mocks.markRead.mockResolvedValue(true);
    const route = new NotificationRead(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "alice", params: { id: "n1" } },
      response,
    );
    expect(mocks.markRead).toHaveBeenCalledWith("db-client", "n1", "alice");
    expect(response.send).toHaveBeenCalled();
    expect(response.code).not.toHaveBeenCalledWith(404);
  });

  it("responds 404 when the notification does not exist", async () => {
    mocks.markRead.mockResolvedValue(false);
    const route = new NotificationRead(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "alice", params: { id: "missing" } },
      response,
    );
    expect(response.code).toHaveBeenCalledWith(404);
  });
});

describe("NotificationsDelete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a notification by id without any permission check", async () => {
    mocks.deleteById.mockResolvedValue(true);
    const route = new NotificationsDelete(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "anyone", params: { id: "n1" } },
      response,
    );
    expect(mocks.deleteById).toHaveBeenCalledWith("db-client", "n1");
    expect(response.send).toHaveBeenCalled();
  });

  it("responds 404 when the notification does not exist", async () => {
    mocks.deleteById.mockResolvedValue(false);
    const route = new NotificationsDelete(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "anyone", params: { id: "missing" } },
      response,
    );
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
