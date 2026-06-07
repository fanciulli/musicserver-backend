import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  recordFailedAttempt,
  resetAttempts,
} from "../../src/utils/loginRateLimiter.js";

const IP = "1.2.3.4";
const OTHER_IP = "5.6.7.8";

describe("loginRateLimiter", () => {
  beforeEach(() => {
    resetAttempts(IP);
    resetAttempts(OTHER_IP);
  });

  it("is not limited with no prior attempts", () => {
    expect(isRateLimited(IP)).toBe(false);
  });

  it("is not limited after 4 failed attempts", () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt(IP);
    expect(isRateLimited(IP)).toBe(false);
  });

  it("is limited after 5 failed attempts", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    expect(isRateLimited(IP)).toBe(true);
  });

  it("stays limited after more than 5 attempts", () => {
    for (let i = 0; i < 8; i++) recordFailedAttempt(IP);
    expect(isRateLimited(IP)).toBe(true);
  });

  it("is no longer limited after resetAttempts", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    resetAttempts(IP);
    expect(isRateLimited(IP)).toBe(false);
  });

  it("does not share state between different IPs", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    expect(isRateLimited(OTHER_IP)).toBe(false);
  });
});
