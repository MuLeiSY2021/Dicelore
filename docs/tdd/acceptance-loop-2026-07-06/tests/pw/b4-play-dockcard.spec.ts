// B4 跑团 · dock-card markdown 模板渲染器 + 归档——期望来自 overview §B4 + play.html。
// 期望：dock-card = markdown 模板渲染器（前端呈现层）：play-card-meta（dc-meta·数据选择器 select…where… + markdown 模板源码 ${xx}·默认隐藏·编辑态显源码）+ play-card-body（dc-body·渲染后 markdown·数据从 sheet 注入）+ 三按钮 play-card-{edit,archive,fold}（去"钉选"）。
//   预设 play-card-{status,plotline,world,other} + play-card-custom（DIY）。
//   归档：play-card-archive 归档（非硬删）→ play-bay-popover-archive（bay 入口 play-bay-btn-archive·空态 play-archive-empty）。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import {
  ROUTE,
  byTestid,
  expectTestidVisible,
  waitForBackend,
} from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · dock-card 与归档", () => {
  let sessionId: string;
  test.beforeAll(async () => {
    await waitForBackend();
    ({ sessionId } = await seedPlaySession());
  });

  test("dock-card 模板渲染器：meta + body + 三按钮", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：play-card-body（渲染后 markdown）+ play-card-meta（数据选择器+模板源码·默认隐藏）+ play-card-{edit,archive,fold}（去钉选）。
    await expectTestidVisible(page, "play-card-body");
    await expectTestidVisible(page, "play-card-meta");
    await expectTestidVisible(page, "play-card-edit");
    await expectTestidVisible(page, "play-card-archive");
    await expectTestidVisible(page, "play-card-fold");
  });

  test("预设卡 + DIY custom", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：预设 play-card-{status,plotline,world,other} + play-card-custom（DIY）。
    await expectTestidVisible(page, "play-card-status");
    await expectTestidVisible(page, "play-card-plotline");
    await expectTestidVisible(page, "play-card-world");
    await expectTestidVisible(page, "play-card-other");
    await expectTestidVisible(page, "play-card-custom");
  });

  test("归档：bay 入口 + popover + 空态", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#bay=archive`);
    // 期望：play-bay-btn-archive（bay 归档入口）→ play-bay-popover-archive（归档卡找回·空态 play-archive-empty）。
    await expectTestidVisible(page, "play-bay-btn-archive");
    await expectTestidVisible(page, "play-bay-popover-archive");
    await expectTestidVisible(page, "play-archive-empty");
  });
});
