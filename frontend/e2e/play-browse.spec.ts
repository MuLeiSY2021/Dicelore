// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { test, expect } from "@playwright/test";

// 跑团页扩展：活动轨切换 + 真实浏览树 + 呈现台。前置:orchestrator :8787(FAKE_GM)。
test.describe("跑团页 · 活动轨/浏览/呈现台", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("quick-play").click();
    await expect(page).toHaveURL(/\/play\//, { timeout: 15_000 });
  });

  test("呈现台渲染导入的开局态(旅人属性)", async ({ page }) => {
    await expect(page.getByText("旅人", { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test("设定源浏览树展示真实 lore(黑风寨)", async ({ page }) => {
    // 默认设定源；浏览树由 GET /browse 真实填充(限定在浏览树内，避开会话栏同名选项)
    await expect(page.locator(".browse .tree").getByText("黑风寨")).toBeVisible({ timeout: 10_000 });
  });

  test("会话栏(可隐藏次级 bar)列出本局会话并可折叠", async ({ page }) => {
    const sel = page.getByLabel("会话", { exact: true });
    await expect(sel).toBeVisible({ timeout: 10_000 });
    // 折叠会话栏
    await page.getByRole("button", { name: "隐藏会话栏" }).click();
    await expect(page.getByRole("button", { name: "显示会话栏" })).toBeVisible();
  });

  test("活动轨切到「工具」源显示已钉/日志", async ({ page }) => {
    await page.getByRole("button", { name: "工具", exact: true }).click();
    await expect(page.getByText(/已钉到呈现台/)).toBeVisible();
  });
});
