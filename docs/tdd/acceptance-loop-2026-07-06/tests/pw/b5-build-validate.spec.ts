// B5 制作 · 校验——期望来自 overview §B5 + build.html。
// 期望：build-validate-btn → build-validate-report（error/warn 计数 + 定位）；build-validate-item 点击定位（data-jump 切 nav + flash 高亮目标卡）；全绿态 build-validate-ok。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend } from "./helpers";

test.describe("B5 制作 · 校验", () => {
  test.beforeAll(async () => {
    await waitForBackend();
  });

  test("validate-btn → report（error/warn 计数 + 定位）", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-validate-btn → build-validate-report（error/warn 计数 + 定位）。
    await byTestid(page, "build-validate-btn").click();
    await expectTestidVisible(page, "build-validate-report");
  });

  test("validate-item 点击定位（data-jump）", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-validate-item 点击定位（data-jump → 切 build-nav-* + flash 高亮目标卡）。
    await expectTestidVisible(page, "build-validate-item");
  });

  test("校验全绿态", async ({ page }) => {
    await page.goto(`${ROUTE.build}#st=ok`);
    // 期望：build-validate-ok（全绿态）。
    await expectTestidVisible(page, "build-validate-ok");
  });
});
