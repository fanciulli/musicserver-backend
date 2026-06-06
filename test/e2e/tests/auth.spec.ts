import { test, expect, type Page } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
const ADMIN_LOGS_URL = `${BACKEND_URL}/admin/logs?id=main`;

async function fillLoginForm(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("/auth/sign-in");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
}

// ─── TEST_01: Wrong password ─────────────────────────────────────────────────
test("TEST_01: login with wrong password returns 401 and shows error", async ({
  page,
}) => {
  await fillLoginForm(page, "admin", "wrong");

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.click('button[type="submit"]'),
  ]);

  expect(response.status()).toBe(401);
  await expect(
    page.locator("p.text-red-600, p.text-red-400"),
  ).toBeVisible();
  await expect(page).toHaveURL(/sign-in/);
});

// ─── TEST_02: Wrong username ─────────────────────────────────────────────────
test("TEST_02: login with wrong username returns 401 and shows error", async ({
  page,
}) => {
  await fillLoginForm(page, "admin1", "admin");

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.click('button[type="submit"]'),
  ]);

  expect(response.status()).toBe(401);
  await expect(
    page.locator("p.text-red-600, p.text-red-400"),
  ).toBeVisible();
  await expect(page).toHaveURL(/sign-in/);
});

// ─── TEST_03: Full login/logout cycle ────────────────────────────────────────
test("TEST_03: login/logout cycle invalidates session token", async ({
  page,
  context,
  request,
}) => {
  // 1. Login via UI
  await fillLoginForm(page, "admin", "admin");

  const [loginResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.click('button[type="submit"]'),
  ]);

  expect(loginResponse.status()).toBe(200);
  await expect(page).not.toHaveURL(/sign-in/);

  // 2. Read session token from httpOnly cookie
  const cookies = await context.cookies();
  const sessionCookie = cookies.find((c) => c.name === "session_token");
  expect(sessionCookie).toBeDefined();
  const token = sessionCookie!.value;
  expect(token.length).toBeGreaterThan(0);

  // 3. Verify token grants access to /admin/logs on the backend
  const logsBefore = await request.get(ADMIN_LOGS_URL, {
    headers: { Authorization: `Bearer ${token}` },
    ignoreHTTPSErrors: true,
  });
  expect(logsBefore.status()).toBe(200);

  // 4. Logout via profile menu
  await page.click('figure[class*="items-center"]');
  await page.click('button:has-text("Log out")');
  await expect(page).toHaveURL(/sign-in/);

  // 5. Verify the same token is now rejected by the backend
  const logsAfter = await request.get(ADMIN_LOGS_URL, {
    headers: { Authorization: `Bearer ${token}` },
    ignoreHTTPSErrors: true,
  });
  expect(logsAfter.status()).toBe(401);
});
