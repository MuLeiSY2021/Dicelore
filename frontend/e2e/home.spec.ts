// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { test, expect } from "@playwright/test";

// 主页 + 顶栏：业务需求(欢迎/快速入口/最近会话/运行态/logo/语言/明暗)。
// 前置:backend 起在 :8787(DICELORE_FAKE_GM=1)。

test.describe("主页 + 顶栏", () => {
  test("品牌 logo + 四导航 + 运行态指示", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Dicelore")).toBeVisible(); // d20 lockup logo
    const bar = page.locator("header.bar");
    for (const label of ["主页", "跑团", "团本制作", "配置"]) {
      await expect(bar.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    // 运行态指示(模型/MCP/notify) 来自 /diagnostics/health
    const status = page.getByLabel("运行态");
    await expect(status).toBeVisible({ timeout: 10_000 });
    await expect(status.getByText(/MCP/)).toBeVisible();
  });

  test("快速开局入口 + 四快速卡片可见", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("quick-play")).toBeVisible();
    const quick = page.locator(".quick");
    for (const t of ["开新局", "团本制作", "会话管理", "配置"]) {
      await expect(quick.getByText(t, { exact: true })).toBeVisible();
    }
  });

  test("语言切换真生效(中→英 改导航文案) + 持久化", async ({ page }) => {
    await page.goto("/");
    const bar = page.locator("header.bar");
    await page.getByRole("button", { name: "语言" }).click();
    await page.getByRole("menuitemradio", { name: /English/ }).click();
    await expect(bar.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Play", exact: true })).toBeVisible();
    // 持久化：刷新后仍是英文
    await page.reload();
    await expect(bar.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  });

  test("明暗切换写到 <html data-theme> 且持久化", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "明暗" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");
  });
});
