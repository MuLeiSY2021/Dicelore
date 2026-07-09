// B2 主页——期望来自 1-frontend-overview §B2 + 原型 home.html。
// 真前端现状：HomePage 无 home-guide/home-recent-session 等原型 testid → 首跑必红。
// 路由：/ （router.tsx index → HomePage）。

import { test, expect } from "@playwright/test";
import { ROUTE, byTestid, expectTestidVisible } from "./helpers";

test.describe("B2 主页", () => {
  test("指南 + 使用手册链接（核心）", async ({ page }) => {
    await page.goto(ROUTE.home);
    // 期望：home-guide 指南正文 + home-manual-link 使用手册 <a> → wiki 指南。
    await expectTestidVisible(page, "home-guide");
    await expectTestidVisible(page, "home-manual-link");
  });

  test("问候语 + 角落运行态徽章", async ({ page }) => {
    await page.goto(ROUTE.home);
    await expectTestidVisible(page, "home-hello");
    await expectTestidVisible(page, "home-runstatus");
  });

  test("仅最近一个会话摘要卡（非全量列表）", async ({ page }) => {
    await page.goto(ROUTE.home);
    // 期望：home-recent-session 最近一个会话摘要卡（整卡 <a href=play> · 内 home-recent-continue 继续按钮）；不出现全量列表。
    await expectTestidVisible(page, "home-recent-session");
    await expectTestidVisible(page, "home-recent-continue");
    // 期望：仅一个 recent-session（非全量）。
    await expect(byTestid(page, "home-recent-session")).toHaveCount(1);
  });

  test("快速入口 + 强 CTA", async ({ page }) => {
    await page.goto(ROUTE.home);
    for (const t of ["catalog", "build", "config"]) {
      await expectTestidVisible(page, `home-quick-${t}`);
    }
  });

  test("首访无会话空态：empty + 烫金主按钮 start-cta → catalog", async ({ page }) => {
    // 期望（#s=empty 原型态）：无会话首访走空态 home-empty-session（隐藏 resume + 首访欢迎 + home-start-cta → catalog）。
    // 真 app 不认 #s=empty，但空态由「无会话」触发——新数据根无会话时 HomePage 应显空态。
    await page.goto(ROUTE.home);
    // 至少二选一：有会话显 recent-session，无会话显 empty-session。期望态两者其一可见。
    const recent = byTestid(page, "home-recent-session");
    const empty = byTestid(page, "home-empty-session");
    await expect(recent.or(empty)).toBeVisible();
    // 空态强 CTA。
    await expectTestidVisible(page, "home-start-cta");
  });
});
