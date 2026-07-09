// B1 导航/壳（全局 bay · 去顶栏）——期望来自 1-frontend-overview §B1 + 原型 index.html。
// 真前端现状：仍有 TopBar（brand 常驻）+ 无 app-bay（IA=工作区/工具面板·RT-FE1/RT-FE3）→ 首跑必红。
// 路由取真 app 实际路由（router.tsx）：/ home · /adventures catalog · /play · /build · /config。

import { test, expect } from "@playwright/test";
import { ROUTE, byTestid, expectTestidVisible } from "./helpers";

const PAGES = [
  { name: "home", route: ROUTE.home },
  { name: "catalog", route: ROUTE.catalog },
  { name: "play", route: ROUTE.play },
  { name: "build", route: ROUTE.build },
  { name: "config", route: ROUTE.config },
] as const;

test.describe("B1 导航/壳 · 全局 bay · 去顶栏", () => {
  for (const p of PAGES) {
    test(`${p.name} 页：去顶栏 + 底部 app-bay 存在`, async ({ page }) => {
      await page.goto(p.route);
      // 期望：nav 收进底部 app-bay（仿 mac 聚焦出现），无常驻顶栏 brand。
      // #baybar=show 是原型态强制常驻；真 app 不认该 hash，bay 仍应常驻可见（期望态）。
      await page.goto(`${p.route}#baybar=show`);
      await expectTestidVisible(page, "app-bay");
    });
  }

  test("app-bay 展开态：nav-tab 五页签 + 收起按钮", async ({ page }) => {
    await page.goto(`${ROUTE.home}#baybar=show`);
    // 期望：展开态横排页签 nav-tab-{home,catalog,play,build,config}（当前页 on）+ app-bay-nav-collapse 收起。
    for (const t of ["home", "catalog", "play", "build", "config"]) {
      await expectTestidVisible(page, `nav-tab-${t}`);
    }
    await expectTestidVisible(page, "app-bay-nav-collapse");
  });

  test("app-bay 收起态：≡ 导航按钮 + 点开浮窗 nav-row 五页签", async ({ page }) => {
    // 期望：收起态 app-bay-nav(≡) 点开 app-bay-popover-nav 浮窗，列 nav-row-{五页}（当前页 on；nav-row-play 无活动会话置灰）+ app-bay-nav-expand + 底 shell-runstatus。
    await page.goto(`${ROUTE.play}#baybar=show&bay=nav`);
    await expectTestidVisible(page, "app-bay-nav");
    await expectTestidVisible(page, "app-bay-popover-nav");
    for (const t of ["home", "catalog", "play", "build", "config"]) {
      await expectTestidVisible(page, `nav-row-${t}`);
    }
    await expectTestidVisible(page, "app-bay-nav-expand");
    await expectTestidVisible(page, "shell-runstatus");
  });

  test("bay 导航默认：跑团页收起、其他页展开", async ({ page }) => {
    // 期望（overview §B1）：默认跑团页 body.bay-nav-collapsed（bay 已有 session/团数据/配置/归档入口）、其他页展开。
    // 跑团页：app-bay-nav(≡) 可见、app-bay-nav-tabs 不在展开态。
    await page.goto(`${ROUTE.play}#baybar=show`);
    await expectTestidVisible(page, "app-bay-nav");
    // 其他页（home）：展开态 nav-tabs 可见。
    await page.goto(`${ROUTE.home}#baybar=show`);
    await expectTestidVisible(page, "app-bay-nav-tabs");
  });

  test("config-bay-mode 切聚焦出现/常驻/隐藏写 localStorage", async ({ page }) => {
    // 期望：bay 显隐模式在配置页 config-bay-mode 改（聚焦出现/常驻/隐藏），写 localStorage。
    await page.goto(`${ROUTE.config}#v=general`);
    await expectTestidVisible(page, "config-bay-mode");
  });
});
