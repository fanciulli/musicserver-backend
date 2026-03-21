import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { transportMock, pinoFactoryMock, infoMock, errorMock } = vi.hoisted(
  () => ({
    transportMock: vi.fn(),
    pinoFactoryMock: vi.fn(),
    infoMock: vi.fn(),
    errorMock: vi.fn(),
  }),
);

vi.mock("pino", () => {
  const pinoMock = Object.assign((...args) => pinoFactoryMock(...args), {
    transport: (...args) => transportMock(...args),
  });

  return {
    default: pinoMock,
  };
});

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    transportMock.mockReturnValue("transport-instance");
    pinoFactoryMock.mockReturnValue({
      info: infoMock,
      error: errorMock,
    });
  });

  it("configures pino with the rolling transport", async () => {
    await import("../../src/server/logging.js");

    expect(transportMock).toHaveBeenCalledWith({
      target: "pino-roll",
      options: {
        file: join("logs", "main"),
        size: 1,
        frequency: "daily",
        mkdir: true,
        dateFormat: "yyyy-MM-dd",
      },
    });
    expect(pinoFactoryMock).toHaveBeenCalledWith("transport-instance");
  });

  it("forwards info messages to the underlying logger", async () => {
    const { Logger } = await import("../../src/server/logging.js");

    const logger = new Logger();
    logger.info("scan started");

    expect(infoMock).toHaveBeenCalledWith("scan started");
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("forwards error messages to the underlying logger", async () => {
    const { Logger } = await import("../../src/server/logging.js");

    const logger = new Logger();
    logger.error("scan failed");

    expect(errorMock).toHaveBeenCalledWith("scan failed");
    expect(infoMock).not.toHaveBeenCalled();
  });
});
