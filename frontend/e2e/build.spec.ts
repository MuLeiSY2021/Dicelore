// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { test, expect } from "@playwright/test";

// 团本制作页：接真 catalog(选团本/读包渲染/校验)。
// 前置:backend :8787。先经主页 quick-play 造一个示例团本，确保 catalog 非空。

test.describe("团本制作页", () => {
  test.beforeEach(async ({ page }) => {
    // 造示例团本(若已存在则幂等)
    await page.goto("/");
    await page.getByTestId("quick-play").click();
    await expect(page).toHaveURL(/\/play\//, { timeout: 15_000 });
  });

  test("选团本 → 左导航类型计数 + 中央渲染真实世界设定", async ({ page }) => {
    await page.goto("/build");
    // 选团本下拉(示例·黑风寨)
    await expect(page.getByLabel("选择团本")).toBeVisible({ timeout: 10_000 });
    // 默认进世界设定类型，应渲染真实 lore 文件路径(lore/黑风寨.md)
    await expect(page.getByText(/lore\/黑风寨\.md/)).toBeVisible({ timeout: 10_000 });
  });

  test("校验整包 → 渲染结构化报告", async ({ page }) => {
    await page.goto("/build");
    await page.getByRole("button", { name: /校验整包/ }).click();
    // 报告区(右栏 .valid)出现结果
    await expect(page.locator(".valid")).toContainText(/校验通过|error|warn/, { timeout: 10_000 });
  });

  test("左导航切换内容类型(Manifest)→ 中央渲染真实 manifest 文件", async ({ page }) => {
    await page.goto("/build");
    await page.locator(".build .sidenav").getByRole("button", { name: /Manifest/ }).click();
    await expect(page.locator(".mbody").getByText("manifest.md")).toBeVisible({ timeout: 10_000 });
  });
});
