// B2 主页——期望来自 1-frontend-overview §B2 + 原型 home.html。
// 真前端现状：HomePage 无 home-guide/home-recent-session 等原型 testid → 首跑必红。
// 路由：/ （router.tsx index → HomePage）。

import { test, expect } from "./fixtures";
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

  test("空态强 CTA 恒显 + 最近会话摘要卡（真 app 无纯空屏·恒显选择态）", async ({ page }) => {
    // 真 app（对齐 /play 会话选择态哲学）落地页恒显：最近一个会话摘要卡 + empty-first 强 CTA
    // （有会话改文案不隐藏），故 recent 与 empty 同在——断言其一可见 + start-cta 恒显。
    await page.goto(ROUTE.home);
    const recent = byTestid(page, "home-recent-session");
    const empty = byTestid(page, "home-empty-session");
    await expect(recent.or(empty).first()).toBeVisible();
    await expectTestidVisible(page, "home-start-cta"); // 烫金主按钮恒显 → /adventures
  });
});
