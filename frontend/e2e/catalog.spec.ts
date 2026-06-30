// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { test, expect } from "@playwright/test";

// 团本目录页(新「团本」)：列 catalog → 开始游戏 → 进 Play 开场层。
// 前置:backend :8787。先 seed 一个团本(经主页 quick-play)。
test.describe("团本目录页", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("quick-play").click();
    await expect(page).toHaveURL(/\/play\//, { timeout: 15_000 });
  });

  test("列出团本 + 顶栏「团本」导航可达", async ({ page }) => {
    await page.locator("header.bar").getByRole("link", { name: "团本", exact: true }).click();
    await expect(page).toHaveURL(/\/packs/);
    await expect(page.getByRole("heading", { name: /团本目录/ })).toBeVisible();
    await expect(page.locator(".ccard").first()).toBeVisible({ timeout: 10_000 });
  });

  test("开始游戏 → 进 Play 开场层(大金按钮)", async ({ page }) => {
    await page.goto("/packs");
    await page.locator(".ccard .btn.go").first().click();
    await expect(page).toHaveURL(/\/play\//, { timeout: 15_000 });
    await expect(page.getByTestId("kickoff")).toBeVisible({ timeout: 10_000 });
  });
});
