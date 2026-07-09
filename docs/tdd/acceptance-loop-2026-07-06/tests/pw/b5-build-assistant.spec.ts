// B5 制作 · 助手对话 + 编排态——期望来自 overview §B5 + build.html。
// 期望：右栏 build-assistant（助手对话）+ build-assistant-toolcalls（显示调了哪些工具）；编排中 build-generating（spinner + build-generating-tools 流式 toolcall + build-generating-cancel 中止）；loregm turn error → build-assistant-error（D3 body.error）。
//   运行时观测族 build-turn-usage（每条助手消息末尾内联 ⟨model·↑↓tok·≈$⟩·RT-FE16/co-build·红态）。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import { ROUTE, expectTestidVisible, waitForBackend } from "./helpers";

test.describe("B5 制作 · 助手与编排态", () => {
  test.beforeAll(async () => {
    await waitForBackend();
  });

  test("助手对话 + toolcalls 可见", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-assistant + build-assistant-toolcalls（显示调了哪些工具）。
    await expectTestidVisible(page, "build-assistant");
    await expectTestidVisible(page, "build-assistant-toolcalls");
  });

  test("编排中态：spinner + 流式 toolcall + 中止", async ({ page }) => {
    await page.goto(`${ROUTE.build}#st=generating`);
    // 期望：build-generating（A3 编排中 spinner）+ build-generating-tools（流式 toolcall）+ build-generating-cancel（中止本轮）。
    await expectTestidVisible(page, "build-generating");
    await expectTestidVisible(page, "build-generating-tools");
    await expectTestidVisible(page, "build-generating-cancel");
  });

  test("loregm turn error 态", async ({ page }) => {
    await page.goto(`${ROUTE.build}#st=error`);
    // 期望：build-assistant-error（loregm turn error·D3 body.error）。
    await expectTestidVisible(page, "build-assistant-error");
  });

  test("运行时观测族 · 回合块尾 turn-usage（RT-FE16 · 红态）", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-turn-usage（每条助手消息末尾内联 ⟨model·↑↓tok·≈$⟩·对称 play·依赖未批准裁决 co-build）。
    await expectTestidVisible(page, "build-turn-usage");
  });
});
