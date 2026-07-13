// B5 制作 · 会话切换 + 新建/提交/导出——期望来自 overview §B5 + build.html。
// 驱动方式：真实 seed loregm + primeBay 点 bay 按钮开 popover + 真提交流程。
//
// 放宽并注明（经作者裁决）：
//  · build-session-lastaction：SessionSummary.lastaction 后端未回填（契约 §10·RT-FE13 留位）。渲染路径已就位（有值即出）。
//  · build-none-recent：build 无活动会话屏（screen none）要求 loregm 会话数为 0，而 none-recent 又要有最近会话
//    → 原型自相矛盾态；本轮删空 loregm 会话验 noSession-hint + 新建入口，none-recent 需「有归档会话但未选中」语义，v1 自动选中首会话故不可达。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, primeBay } from "./helpers";
import { freshLoreSession } from "./seed";

test.describe("B5 制作 · 会话切换与提交/导出", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("bay session：列表 + 日期 + 新建", async ({ page }) => {
    await primeBay(page);
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await byTestid(page, "build-bay-btn-session").click();
    await expectTestidVisible(page, "build-bay-popover-session");
    await expect(byTestid(page, "build-session-item").first()).toBeVisible();
    await expect(byTestid(page, "build-session-date").first()).toBeVisible();
    await expectTestidVisible(page, "build-session-new");
    // build-session-lastaction 见文件头注（后端未回填）。
  });

  test("新建构建会话入口（无活动会话整屏 = 组件单测覆盖）", async ({ page }) => {
    // 注：build-noSession-hint 整屏需 loregm 会话数为 0；共享测试后端 DELETE 只清内存 registry、
    // 不清列表源（累积 80+ 会话不可清空）→ none 屏 e2e 不可达，其渲染路径由 BuildPage.test「无会话态」组件单测覆盖。
    // 此处 e2e 验可达的「新建会话」入口（bay session popover 内 build-session-new）。
    await primeBay(page);
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await byTestid(page, "build-bay-btn-session").click();
    await expectTestidVisible(page, "build-bay-popover-session");
    await expectTestidVisible(page, "build-session-new");
  });

  test("新建会话表单", async ({ page }) => {
    await primeBay(page);
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await byTestid(page, "build-bay-btn-session").click();
    await byTestid(page, "build-session-new").click();
    await expectTestidVisible(page, "build-new-modal");
    await expectTestidVisible(page, "build-new-name");
    await expectTestidVisible(page, "build-new-confirm");
  });

  test("已提交/导出态：版本号 + continue + 跳目录", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    // 发一句 → FAKE 构建档写 Draft（含 manifest.name），提交才有 packName。
    const box = page.locator(".cin .box");
    await box.fill("起一个团本骨架");
    await byTestid(page, "build-send").click();
    await expect(byTestid(page, "build-assistant").first()).toContainText("已处理", { timeout: 15_000 });
    await byTestid(page, "build-commit-btn").click();
    await expectTestidVisible(page, "build-exported");
    await expectTestidVisible(page, "build-exported-continue");
    await expectTestidVisible(page, "build-exported-tocatalog");
  });
});
