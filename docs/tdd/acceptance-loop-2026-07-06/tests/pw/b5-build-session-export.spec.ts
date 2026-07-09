// B5 制作 · 会话切换 + 新建/提交/导出——期望来自 overview §B5 + build.html。
// 期望：build-bay-btn-session → build-bay-popover-session（build-session-item/date/lastaction + build-session-new/build-session-new-main）；无活动会话 build-noSession-hint（build-none-recent 可点恢复）。
//   新建表单 build-new-modal（build-new-name/build-new-flows/build-new-clock/build-new-entry + build-new-confirm）。
//   build-commit-btn（提交版本到库）/ build-export-btn（导出 Pack）拆分；已提交/导出态 build-exported（版本号+commitId+归档·build-exported-continue 继续/build-exported-tocatalog 跳目录）。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend } from "./helpers";

test.describe("B5 制作 · 会话切换与提交/导出", () => {
  test.beforeAll(async () => {
    await waitForBackend();
  });

  test("bay session：列表 + 日期 + 最近动作 + 新建", async ({ page }) => {
    await page.goto(`${ROUTE.build}#bay=session`);
    // 期望：build-bay-btn-session → build-bay-popover-session（build-session-item/date/lastaction + build-session-new + build-session-new-main）。
    await expectTestidVisible(page, "build-bay-btn-session");
    await expectTestidVisible(page, "build-bay-popover-session");
    await expectTestidVisible(page, "build-session-item");
    await expectTestidVisible(page, "build-session-date");
    await expectTestidVisible(page, "build-session-lastaction");
    await expectTestidVisible(page, "build-session-new");
  });

  test("无活动会话态 + 可点恢复", async ({ page }) => {
    await page.goto(`${ROUTE.build}#st=none`);
    // 期望：build-noSession-hint（无活动会话整屏）+ build-none-recent（可点恢复）。
    await expectTestidVisible(page, "build-noSession-hint");
    await expectTestidVisible(page, "build-none-recent");
  });

  test("新建会话表单", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-session-new → build-new-modal（build-new-name 团本名/build-new-flows/build-new-clock/build-new-entry + build-new-confirm）。
    await byTestid(page, "build-session-new").first().click();
    await expectTestidVisible(page, "build-new-modal");
    await expectTestidVisible(page, "build-new-name");
    await expectTestidVisible(page, "build-new-confirm");
  });

  test("已提交/导出态：版本号 + continue + 跳目录", async ({ page }) => {
    await page.goto(`${ROUTE.build}#st=exported`);
    // 期望：build-exported（版本号 + commitId + 归档·build-exported-continue 继续/build-exported-tocatalog 跳目录）。
    await expectTestidVisible(page, "build-exported");
    await expectTestidVisible(page, "build-exported-continue");
    await expectTestidVisible(page, "build-exported-tocatalog");
  });
});
