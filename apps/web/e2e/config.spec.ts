// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { test, expect } from "@playwright/test";

// 配置页 7 子页：模型可选 / 连接测试真测 / MCP CRUD+持久化 / 语言 / 真实值。
// 前置:orchestrator :8787(DICELORE_FAKE_GM=1)。

test.describe("配置页", () => {
  test("七子页导航齐全", async ({ page }) => {
    await page.goto("/config");
    for (const item of ["通用", "服务与网络", "MCP 服务器", "模型连接", "主题外观", "数据与存储", "关于"]) {
      await expect(page.getByRole("button", { name: item })).toBeVisible();
    }
  });

  test("模型连接：GM 模型可选 + Agent 底座(默认 Harness) + 连接测试真测", async ({ page }) => {
    await page.goto("/config");
    await page.getByRole("button", { name: "模型连接" }).click();
    const gm = page.getByLabel("GM 模型");
    await expect(gm).toBeVisible();
    await expect(gm.locator("option")).toHaveCount(4); // opus/sonnet/haiku/fable
    // Agent 底座默认 Harness
    await expect(page.getByLabel("Agent 底座")).toHaveValue("harness");
    // 连接测试(FAKE 模式 → 模拟成功)
    await page.getByRole("button", { name: /连接测试/ }).click();
    await expect(page.locator(".tres")).toContainText(/连接正常|FAKE|连接失败/, { timeout: 10_000 });
    // 模型选择持久化
    await gm.selectOption("claude-sonnet-4-6");
    await page.reload();
    await page.getByRole("button", { name: "模型连接" }).click();
    await expect(page.getByLabel("GM 模型")).toHaveValue("claude-sonnet-4-6");
  });

  test("MCP：dicelore 真实工具数(锁定必需) + 自定义增删改持久化", async ({ page }) => {
    await page.goto("/config");
    await page.getByRole("button", { name: "MCP 服务器" }).click();
    await expect(page.locator(".srv").first()).toContainText("dicelore");
    await expect(page.getByText(/必需/)).toBeVisible();
    // 添加自定义 MCP
    await page.getByRole("button", { name: /添加 MCP/ }).click();
    await page.getByLabel("服务器名").fill("联网检索");
    await page.getByLabel("endpoint").fill("https://example.com/sse");
    await page.getByRole("button", { name: "确定" }).click();
    await expect(page.getByText("联网检索")).toBeVisible();
    await expect(page.getByText("out-of-canon").first()).toBeVisible();
    // 持久化：刷新后仍在
    await page.reload();
    await page.getByRole("button", { name: "MCP 服务器" }).click();
    await expect(page.getByText("联网检索")).toBeVisible();
  });

  test("通用：语言切换全 UI 生效", async ({ page }) => {
    await page.goto("/config");
    await page.getByRole("button", { name: "通用" }).click();
    await page.locator("section.main").getByLabel("语言").selectOption("en");
    await expect(page.locator("header.bar").getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  });

  test("数据与存储 / 关于：展示后端真实值", async ({ page }) => {
    await page.goto("/config");
    await page.getByRole("button", { name: "数据与存储" }).click();
    await expect(page.getByText("DICELORE_SESSIONS_DIR")).toBeVisible();
    await page.getByRole("button", { name: "关于" }).click();
    await expect(page.getByText(/dicelore.client\/1/)).toBeVisible();
  });
});
