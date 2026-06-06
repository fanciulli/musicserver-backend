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

test("AUTH_001: Login with wrong password returns 401 and shows error", async ({
  page,
}) => {
  await fillLoginForm(page, "admin", "wrong");

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.click('button[type="submit"]'),
  ]);

  expect(response.status()).toBe(401);
  await expect(page.locator("p.text-red-600")).toBeVisible();
  await expect(page).toHaveURL(/sign-in/);
});

test("AUTH_0_02: Login with wrong username returns 401 and shows error", async ({
  page,
}) => {
  await fillLoginForm(page, "admin1", "admin");

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.click('button[type="submit"]'),
  ]);

  expect(response.status()).toBe(401);
  await expect(page.locator("p.text-red-600")).toBeVisible();
  await expect(page).toHaveURL(/sign-in/);
});

test("AUTH_003: Login/logout cycle invalidates session token", async ({
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

  // 4. Logout via profile menu — click the username dropdown, then the button
  await page.locator("figcaption").click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/sign-in/);

  // 5. Verify the same token is now rejected by the backend
  const logsAfter = await request.get(ADMIN_LOGS_URL, {
    headers: { Authorization: `Bearer ${token}` },
    ignoreHTTPSErrors: true,
  });
  expect(logsAfter.status()).toBe(401);
});
