// B4 跑团 · dock-card markdown 模板渲染器 + 归档——期望来自 overview §B4 + play.html。
// 驱动方式：真实 seed + 开局 → dock 从 presentation 派生预设卡（status←sheets · world←lore）。
// dc-meta（模板源码）默认隐藏（对齐原型 display:none）、编辑态显 → 断言前先点 play-card-edit。
//
// 放宽并注明（经作者裁决 · 基础 fixture 无 narrative-域数据）：
//  · play-card-plotline：需 presentation.plotlines 非空（narrative 域 plotline_visible 投影）；基础 fixture 无 plotline。
//  · play-card-other：Front/Clock 预设卡 v1 未从 sheet 派生（clock cell 落为普通 sheet cell）；需 Front/Clock 派生 + 团本数据。
// 前端渲染路径已就位（useDock 按类别挂 play-card-{status,plotline,world,custom} testid；有数据即真出）。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, kickoffToInput, primeBay } from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · dock-card 与归档", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("dock-card 模板渲染器：body + 三按钮 + 编辑态显 meta", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    // 每卡：body（渲染后 markdown）+ 三按钮（edit/archive/fold）。多卡 → 取首卡。
    await expect(byTestid(page, "play-card-body").first()).toBeVisible();
    await expect(byTestid(page, "play-card-edit").first()).toBeVisible();
    await expect(byTestid(page, "play-card-archive").first()).toBeVisible();
    await expect(byTestid(page, "play-card-fold").first()).toBeVisible();
    // dc-meta（模板源码）默认隐藏，点编辑才显。
    await byTestid(page, "play-card-edit").first().click();
    await expect(byTestid(page, "play-card-meta").first()).toBeVisible();
  });

  test("预设卡（status/world）+ DIY custom", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    // fixture：hero sheet → status 卡；eval lore → world 卡。
    await expectTestidVisible(page, "play-card-status");
    await expectTestidVisible(page, "play-card-world");
    // DIY：点「新建 DIY 卡」→ play-card-custom。
    await byTestid(page, "play-dock-add").click();
    await expectTestidVisible(page, "play-card-custom");
    // plotline/other 见文件头注（基础 fixture 无 narrative 域数据）。
  });

  test("归档：bay 入口 + popover + 空态", async ({ page }) => {
    await primeBay(page);
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await byTestid(page, "play-bay-btn-archive").click();
    await expectTestidVisible(page, "play-bay-popover-archive");
    await expectTestidVisible(page, "play-archive-empty");
  });
});
