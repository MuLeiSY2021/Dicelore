// B6 配置页——期望来自 1-frontend-overview §B6 + 原型 config.html。
// 真前端现状：ConfigPage 无 config-nav-*/config-model-test-btn 等原型 testid → 首跑必红。
// 路由：/config （router.tsx）。

import { test, expect } from "@playwright/test";
import { ROUTE, byTestid, expectTestidVisible } from "./helpers";

test.describe("B6 配置页", () => {
  test("七子页导航", async ({ page }) => {
    await page.goto(ROUTE.config);
    // 期望：config-nav-{general,network,mcp,model,theme,data,about} 七子页。
    for (const t of [
      "general",
      "network",
      "mcp",
      "model",
      "theme",
      "data",
      "about",
    ]) {
      await expectTestidVisible(page, `config-nav-${t}`);
    }
    await expectTestidVisible(page, "config-subpage");
  });

  test("连接测试拆名：model-test / mcp-test → 三态", async ({ page }) => {
    await page.goto(`${ROUTE.config}#v=model`);
    // 期望：config-model-test-btn（模型）/ config-mcp-test-btn（MCP）→ config-test-{none,pending,ok,fail} 三态（fail 文案接 error.code）。
    await expectTestidVisible(page, "config-model-test-btn");
    await page.goto(`${ROUTE.config}#v=mcp`);
    await expectTestidVisible(page, "config-mcp-test-btn");
    // 三态 testid 至少 none 态存在（期望态）。
    await expectTestidVisible(page, "config-test-none");
  });

  test("model 子页关键控件", async ({ page }) => {
    await page.goto(`${ROUTE.config}#v=model`);
    // 期望：config-model-select、config-agent-base、config-baseurl、config-autocontinue、config-lang、config-key-input(+config-key-toggle 可见性)。
    await expectTestidVisible(page, "config-model-select");
    await expectTestidVisible(page, "config-key-input");
    await expectTestidVisible(page, "config-key-toggle");
  });

  test("custom-mcp 新增表单", async ({ page }) => {
    await page.goto(`${ROUTE.config}#v=mcp`);
    // 期望：config-mcp-list（空态 config-mcp-empty + 核心 config-mcp-core/toolcount + config-mcp-toggle 启停）/ config-mcp-add → config-mcp-add-modal（instance/package/command/args + config-table[config-add/cfg-del] + add-confirm）。
    await expectTestidVisible(page, "config-mcp-list");
    await expectTestidVisible(page, "config-mcp-add");
    await byTestid(page, "config-mcp-add").click();
    await expectTestidVisible(page, "config-mcp-add-modal");
    await expectTestidVisible(page, "config-mcp-package");
    await expectTestidVisible(page, "config-mcp-command");
    await expectTestidVisible(page, "config-mcp-add-confirm");
  });

  test("theme 即时应用 + 持久化", async ({ page }) => {
    await page.goto(`${ROUTE.config}#v=theme`);
    // 期望：config-theme-{preset,mode,accent,font}（明暗/强调色即时应用 + 持久化）。
    await expectTestidVisible(page, "config-theme-preset");
    await expectTestidVisible(page, "config-theme-mode");
    await expectTestidVisible(page, "config-theme-accent");
    await expectTestidVisible(page, "config-theme-font");
  });

  test("data 只读真值 + net 端口/通知只读 + about 版本（来自 health）", async ({ page }) => {
    await page.goto(`${ROUTE.config}#v=data`);
    await expectTestidVisible(page, "config-data-readonly");
    await page.goto(`${ROUTE.config}#v=network`);
    await expectTestidVisible(page, "config-net-port");
    await expectTestidVisible(page, "config-net-notify");
    await page.goto(`${ROUTE.config}#v=about`);
    await expectTestidVisible(page, "config-about-version");
  });
});
