// B5 制作 · 校验——期望来自 overview §B5 + build.html。
// 驱动方式：真实 seed loregm + 真 validateDraft（POST …/draft/validate）。
//   空 Draft → 1 error（build-validate-item）；发一句 → FAKE 构建档写最小骨架 → 0 issue（build-validate-ok）。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend } from "./helpers";
import { freshLoreSession } from "./seed";

test.describe("B5 制作 · 校验", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("validate-btn → report（error/warn 计数 + 定位）", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await byTestid(page, "build-validate-btn").click();
    await expectTestidVisible(page, "build-validate-report");
  });

  test("validate-item 点击定位（data-jump）", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    // 空 Draft → validate 出 error 条目（可点定位）。
    await byTestid(page, "build-validate-btn").click();
    await expect(byTestid(page, "build-validate-item").first()).toBeVisible({ timeout: 10_000 });
  });

  test("校验全绿态", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    // 发一句 → FAKE 构建档写最小可校验骨架（manifest/prologue/lore/rule/state）。
    const box = page.locator(".cin .box");
    await box.fill("起一个最小团本骨架");
    await byTestid(page, "build-send").click();
    await expect(byTestid(page, "build-assistant").first()).toContainText("已处理", { timeout: 15_000 });
    await byTestid(page, "build-validate-btn").click();
    await expectTestidVisible(page, "build-validate-ok");
  });
});
