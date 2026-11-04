import { expect, type Page, test } from "@playwright/test";
import { authFile, signInCookies } from "./support/auth";
import { userClient } from "./support/db";
import { resetReminder } from "./support/seed";

// The Reminder tests change jo's settings and push subscriptions, so they run one at a time.
test.describe.configure({ mode: "serial" });
test.use({
  storageState: authFile("jo"),
  timezoneId: "Australia/Sydney",
  permissions: ["notifications"],
});

// A real push service can't be reached from a test, so a stand-in worker registration keeps one
// fake subscription in localStorage (so it survives a reload), exactly as the browser would.
async function standInForPush(page: Page) {
  await page.addInitScript(() => {
    const STORE = "e2e-push-subscription";
    const subscription = () => {
      const saved = localStorage.getItem(STORE);
      if (!saved) return null;
      const { endpoint, key } = JSON.parse(saved) as {
        endpoint: string;
        key: number[];
      };
      return {
        endpoint,
        options: { applicationServerKey: new Uint8Array(key).buffer },
        toJSON: () => ({
          endpoint,
          keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" },
        }),
        unsubscribe: async () => {
          localStorage.removeItem(STORE);
          return true;
        },
      };
    };
    const registration = {
      pushManager: {
        getSubscription: async () => subscription(),
        subscribe: async (options: { applicationServerKey: Uint8Array }) => {
          localStorage.setItem(
            STORE,
            JSON.stringify({
              endpoint: `https://push.example.test/${crypto.randomUUID()}`,
              key: [...options.applicationServerKey],
            }),
          );
          return subscription();
        },
      },
    };
    // Headless Chrome reports "denied" until asked, which no phone does, so the permission is
    // stood in for as well: "default" until the switch asks, then granted.
    let permission: NotificationPermission = "default";
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => permission,
    });
    Notification.requestPermission = async () => {
      permission = "granted";
      return permission;
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
        // The app registers its worker on every page in a production build.
        register: async () => registration,
        getRegistration: async () => registration,
      },
    });
  });
}

const reminderSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Daily reminder" });
const timeField = (page: Page) => page.getByLabel("Remind me at");

const settingsWritten = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() !== "GET" &&
      response.url().includes("/rest/v1/user_settings"),
  );

async function saved() {
  const jo = await userClient("jo");
  const settings = await jo
    .from("user_settings")
    .select("reminder_enabled, reminder_time, time_zone")
    .maybeSingle();
  const subscriptions = await jo
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  return { settings: settings.data, subscriptions: subscriptions.data ?? [] };
}

test.beforeEach(async ({ page }) => {
  await resetReminder(await userClient("jo"));
  await standInForPush(page);
});

test("a new User has the Reminder off, with nothing to choose yet (AC-1)", async ({
  page,
}) => {
  await page.goto("/settings");

  await expect(reminderSwitch(page)).not.toBeChecked();
  await expect(timeField(page)).toHaveCount(0);
});

test("turning it on subscribes this phone and saves the Reminder with the phone's time zone (AC-1, AC-2, AC-3)", async ({
  page,
}) => {
  await page.goto("/settings");
  const write = settingsWritten(page);

  await reminderSwitch(page).click();
  await write;

  await expect(reminderSwitch(page)).toBeChecked();
  await expect(timeField(page)).toHaveValue("19:00");
  const { settings, subscriptions } = await saved();
  expect(settings).toMatchObject({
    reminder_enabled: true,
    reminder_time: "19:00:00",
    time_zone: "Australia/Sydney",
  });
  expect(subscriptions).toHaveLength(1);
  expect(subscriptions[0]).toMatchObject({
    p256dh: "e2e-p256dh",
    auth: "e2e-auth",
  });
});

test("the time is kept across a reload, on a quarter hour (AC-1, AC-3)", async ({
  page,
}) => {
  await page.goto("/settings");
  await reminderSwitch(page).click();
  await expect(timeField(page)).toBeVisible();

  const write = settingsWritten(page);
  await timeField(page).fill("07:45");
  await write;

  await page.reload();
  await expect(timeField(page)).toHaveValue("07:45");
  expect((await saved()).settings?.reminder_time).toBe("07:45:00");
});

test("turning it off switches the Reminder off and forgets this phone (AC-8)", async ({
  page,
}) => {
  await page.goto("/settings");
  await reminderSwitch(page).click();
  await expect(timeField(page)).toBeVisible();
  await expect.poll(async () => (await saved()).subscriptions.length).toBe(1);

  await reminderSwitch(page).click();

  await expect(reminderSwitch(page)).not.toBeChecked();
  await expect(timeField(page)).toHaveCount(0);
  await expect.poll(async () => (await saved()).subscriptions.length).toBe(0);
  expect((await saved()).settings?.reminder_enabled).toBe(false);
});

test("a Reminder turned on from another phone is offered here, not assumed (AC-3)", async ({
  page,
}) => {
  const jo = await userClient("jo");
  await jo.from("user_settings").upsert({
    reminder_enabled: true,
    reminder_time: "18:30",
    time_zone: "Australia/Sydney",
  });

  await page.goto("/settings");

  await expect(reminderSwitch(page)).not.toBeChecked();
  await expect(page.getByText(/on for your other phones/i)).toBeVisible();
});

test("refused notifications keep the switch off and say why (AC-2)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "default",
    });
    Notification.requestPermission = async () => "denied";
  });
  await page.goto("/settings");

  await reminderSwitch(page).click();

  await expect(
    page.getByText(
      "Notifications are blocked for this app in Android settings.",
    ),
  ).toBeVisible();
  await expect(reminderSwitch(page)).not.toBeChecked();
  expect((await saved()).subscriptions).toHaveLength(0);
});

test("a phone that can't receive push says so and can't turn it on (AC-2)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "PushManager");
  });
  await page.goto("/settings");

  await expect(
    page.getByText("This device can't show reminders."),
  ).toBeVisible();
  await expect(reminderSwitch(page)).toBeDisabled();
});

test("signing out removes this phone's subscription (AC-8)", async ({
  page,
  context,
}) => {
  // A fresh session, so signing out cannot disturb the shared stored one.
  await context.clearCookies();
  await context.addCookies(
    await signInCookies(
      "jo",
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      "127.0.0.1",
    ),
  );
  await page.goto("/settings");
  await reminderSwitch(page).click();
  await expect(timeField(page)).toBeVisible();
  await expect.poll(async () => (await saved()).subscriptions.length).toBe(1);

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await expect.poll(async () => (await saved()).subscriptions.length).toBe(0);
});
