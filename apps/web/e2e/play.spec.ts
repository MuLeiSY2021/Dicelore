// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { test, expect } from "@playwright/test";

// 端到端「造团本 → 开局 → 玩」闭环。
// 前置:orchestrator 起在 :8787 且 DICELORE_FAKE_GM=1(脚本化 GM,不烧 LLM);vite dev 由 webServer 拉起。
//   cd apps/orchestrator && DICELORE_FAKE_GM=1 PORT=8787 npx tsx src/server.ts
test("造示例团本 → 开局 import → 跑一回合 → 看到导入态与叙事", async ({ page }) => {
  await page.goto("/");

  // 1. 首页「造团本并开局」→ 跳跑团页
  await page.getByTestId("quick-play").click();
  await expect(page).toHaveURL(/\/play\/s-[0-9a-f]{8}/);

  // 2. 呈现台显示导入的开局态(旅人 HP 12)
  const stage = page.getByLabel("呈现台");
  await expect(stage.getByText("旅人", { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(stage.getByText("12", { exact: true })).toBeVisible();

  // 3. 开场层：未开场 → 大金「点击开始游戏」按钮(非输入框)。点它 kickoff → FAKE GM 流式开场。
  await expect(page.getByTestId("kickoff")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("kickoff").click();
  await expect(page.locator(".narr p").filter({ hasText: /门吱呀一声开了|你说/ })).toBeVisible({ timeout: 10_000 });
  // 4. 开场后进入续玩层：输入框出现
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });
});
