import { expect, test, type Page } from "@playwright/test";

const endpoint = "/api/public/briefing/00000000-0000-4000-8000-000000000001";
const url = "/briefing/00000000-0000-4000-8000-000000000001";
const fixture = (title = "Врач-стоматолог") => ({
  title,
  updatedAt: "2026-10-11T12:00:00.000Z",
  busy: false,
  answers: [
    {
      topic: "purpose",
      question: "Задача найма",
      answer: "Открытие нового кабинета",
    },
  ],
  intake: {
    messages: Array.from({ length: 32 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `Сообщение ${i + 1}. ${"Обсуждаем требования к сотруднику. ".repeat(5)}`,
    })),
    completed: false,
    openQuestions: ["Какой график работы?"],
  },
  lastTurn: undefined as
    | undefined
    | { id: string; message: string; status: string },
});
async function dimensions(page: Page) {
  return page.getByRole("log", { name: "История чата" }).evaluate((el) => ({
    top: el.scrollTop,
    height: el.clientHeight,
    total: el.scrollHeight,
  }));
}

for (const width of [1440, 390]) {
  test(`chat scrolls independently and summary is accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const data = fixture(
      width === 390 ? "Менеджер по продажам" : "Врач-стоматолог",
    );
    await page.route(`**${endpoint}`, (route) => route.fulfill({ json: data }));
    await page.goto(url, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: data.title })).toBeVisible();
    const input = page.getByLabel("Сообщение руководителя");
    const before = await input.boundingBox();
    expect(before).not.toBeNull();
    expect(before!.y + before!.height).toBeLessThan(800);
    expect((await dimensions(page)).top).toBeGreaterThan(100);
    await page.getByRole("log").evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(
      page.getByRole("button", { name: "К последним сообщениям" }),
    ).toBeVisible();
    const after = await input.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
    await page.getByRole("button", { name: "К последним сообщениям" }).click();
    await expect
      .poll(async () => {
        const d = await dimensions(page);
        return d.total - d.top - d.height;
      })
      .toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Проверить итог", exact: true })
      .click();
    await expect(page.getByLabel("Задача найма")).toHaveValue(
      "Открытие нового кабинета",
    );
    await expect(
      page.getByText("Какой график работы?", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Продолжить разговор" }).click();
    await expect(input).toBeVisible();
  });
}

test("Enter sends immediately, Shift+Enter inserts a line, and a completed turn restores after reload", async ({
  page,
}) => {
  const data = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let sent = "";
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() === "POST") {
      sent = route.request().postDataJSON().message;
      await gate;
      data.intake.messages.push(
        { role: "user", content: sent },
        { role: "assistant", content: "Какие результаты ожидаете от врача?" },
      );
    }
    await route.fulfill({ json: data });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const input = page.getByLabel("Сообщение руководителя");
  await input.fill("Нужен врач");
  await input.press("Shift+Enter");
  await input.pressSequentially("Для нового кабинета");
  await expect(input).toHaveValue("Нужен врач\nДля нового кабинета");
  await input.press("Enter");
  await expect(
    page
      .getByRole("log")
      .getByText("Нужен врач\nДля нового кабинета", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("ИИ готовит ответ…", { exact: true }),
  ).toBeVisible();
  await expect(input).toBeDisabled();
  release();
  await expect(input).toHaveValue("");
  await expect(
    page.getByRole("log").getByText(sent, { exact: true }),
  ).toHaveCount(1);
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.getByText("Какие результаты ожидаете от врача?", { exact: true }),
  ).toBeVisible();
});

test("failure preserves the draft and retry reuses the saved request", async ({
  page,
}) => {
  const data = fixture();
  const ids: string[] = [];
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      ids.push(body.requestId);
      if (ids.length === 1) {
        data.lastTurn = {
          id: body.requestId,
          message: body.message,
          status: "failed",
        };
        await route.fulfill({
          status: 503,
          json: { error: "Провайдер временно недоступен." },
        });
        return;
      }
      data.lastTurn = undefined;
      data.intake.messages.push(
        { role: "user", content: body.message },
        { role: "assistant", content: "Уточним график работы." },
      );
    }
    await route.fulfill({ json: data });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const input = page.getByLabel("Сообщение руководителя");
  await input.fill("Нужен врач в новый кабинет");
  await input.press("Enter");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Провайдер временно недоступен." }),
  ).toBeVisible();
  await expect(input).toHaveValue("Нужен врач в новый кабинет");
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Повторить сохранённое сообщение" })
    .click();
  await expect(
    page.getByText("Уточним график работы.", { exact: true }),
  ).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[1]).toBe(ids[0]);
});

test("completed briefing shows its requirements without reopening the composer", async ({
  page,
}) => {
  const data = fixture();
  data.intake.completed = true;
  await page.setViewportSize({ width: 390, height: 800 });
  await page.route(`**${endpoint}`, (route) => route.fulfill({ json: data }));
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(page.getByLabel("Сообщение руководителя")).toHaveCount(0);
  await page.getByRole("button", { name: "Посмотреть итог" }).click();
  await expect(page.getByLabel("Задача найма")).toHaveValue(
    "Открытие нового кабинета",
  );
  await expect(page.getByLabel("Задача найма")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Подтвердить и передать HR" }),
  ).toHaveCount(0);
});

test("cancellation releases the composer and ignores a late response", async ({
  page,
}) => {
  const data = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (body.action === "cancel") {
        await route.fulfill({ json: data });
        release();
        return;
      }
      if (first) {
        first = false;
        await gate;
        try {
          await route.fulfill({
            json: {
              ...data,
              intake: {
                ...data.intake,
                messages: [{ role: "assistant", content: "Запоздалый ответ" }],
              },
            },
          });
        } catch {
          /* Request was aborted by the client. */
        }
        return;
      }
      data.intake.messages.push(
        { role: "user", content: body.message },
        { role: "assistant", content: "Ответ на новое сообщение" },
      );
    }
    await route.fulfill({ json: data });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const input = page.getByLabel("Сообщение руководителя");
  await input.fill("Первое сообщение");
  await input.press("Enter");
  await page.getByRole("button", { name: "Отменить запрос" }).click();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("Первое сообщение");
  await input.fill("Новое сообщение");
  await input.press("Enter");
  await expect(
    page.getByText("Ответ на новое сообщение", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Запоздалый ответ", { exact: true })).toHaveCount(
    0,
  );
  await expect(input).toHaveValue("");
});
