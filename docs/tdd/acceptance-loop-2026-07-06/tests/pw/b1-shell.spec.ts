// B1 导航/壳（全局 bay · 去顶栏）——期望来自 1-frontend-overview §B1 + 原型 index.html。
// 驱动方式：真实交互（primeBay 写 localStorage bay-mode=always 让 bay 常驻可点 · 点 ≡ 开 nav 浮窗），
// 不用 hash harness。路由取真 app 实际路由（router.tsx）。

import { test } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, primeBay } from "./helpers";

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
      await primeBay(page); // bay 常驻（真产品「配置页 bay 行为=常驻」设置）
      await page.goto(p.route);
      await expectTestidVisible(page, "app-bay");
    });
  }

  test("app-bay 展开态：nav-tab 五页签 + 收起按钮", async ({ page }) => {
    await primeBay(page);
    await page.goto(ROUTE.home); // 非跑团页默认展开 → 横排页签可见
    for (const t of ["home", "catalog", "play", "build", "config"]) {
      await expectTestidVisible(page, `nav-tab-${t}`);
    }
    await expectTestidVisible(page, "app-bay-nav-collapse");
  });

  test("app-bay 收起态：≡ 导航按钮 + 点开浮窗 nav-row 五页签", async ({ page }) => {
    await primeBay(page);
    await page.goto(ROUTE.play); // 跑团页默认收起 → ≡ 可见
    await expectTestidVisible(page, "app-bay-nav");
    await byTestid(page, "app-bay-nav").click(); // 点 ≡ 开 nav 浮窗
    await expectTestidVisible(page, "app-bay-popover-nav");
    for (const t of ["home", "catalog", "play", "build", "config"]) {
      await expectTestidVisible(page, `nav-row-${t}`);
    }
    await expectTestidVisible(page, "app-bay-nav-expand");
    await expectTestidVisible(page, "shell-runstatus");
  });

  test("bay 导航默认：跑团页收起、其他页展开", async ({ page }) => {
    await primeBay(page);
    await page.goto(ROUTE.play);
    await expectTestidVisible(page, "app-bay-nav"); // 跑团页收起 → ≡ 可见
    await page.goto(ROUTE.home);
    await expectTestidVisible(page, "app-bay-nav-tabs"); // 其他页展开 → 横排页签可见
  });

  test("config-bay-mode 切聚焦出现/常驻/隐藏写 localStorage", async ({ page }) => {
    await page.goto(`${ROUTE.config}#v=general`);
    await expectTestidVisible(page, "config-bay-mode");
  });
});
