// B5 制作 · 运行时观测族 + materials/relation/guideline/card-edit——期望来自 overview §B5 + build.html。
// 驱动方式：真实 seed loregm + primeBay 点 bay 用量按钮 + 点左导航切 data-view + 发指令写 Draft 后 inline 编辑。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, primeBay } from "./helpers";
import { freshLoreSession } from "./seed";

test.describe("B5 制作 · 域机态与运行时观测族", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("运行时观测族 · 用量详情浮窗 + 上下文圆盘", async ({ page }) => {
    await primeBay(page);
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await byTestid(page, "build-bay-btn-usage").click();
    await expectTestidVisible(page, "build-bay-popover-usage");
    await expectTestidVisible(page, "build-context-dial");
  });

  test("materials 素材包视图：流式上传", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await byTestid(page, "build-nav-materials").click();
    await expectTestidVisible(page, "build-materials-drop");
    await expectTestidVisible(page, "build-materials-list");
  });

  test("关系图谱视图", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await byTestid(page, "build-nav-relation").click();
    await expectTestidVisible(page, "build-nav-relation");
  });

  test("guideline 5 阶段跳转", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    for (const t of ["source", "world", "npc", "rule", "manifest"]) {
      await expectTestidVisible(page, `build-guideline-${t}`);
    }
  });

  test("内容卡 inline 编辑 + 新建", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    // 发一句 → FAKE 构建档写 lore/rule/state → 内容卡出现，方可 inline 编辑。
    const box = page.locator(".cin .box");
    await box.fill("补世界设定与规则");
    await byTestid(page, "build-send").click();
    await expect(byTestid(page, "build-assistant").first()).toContainText("已处理", { timeout: 15_000 });
    await byTestid(page, "build-nav-lore").click(); // lore 域有卡（FAKE 写「世界设定」）
    await expect(byTestid(page, "build-card-edit").first()).toBeVisible();
    await expect(byTestid(page, "build-card-del").first()).toBeVisible();
    await expectTestidVisible(page, "build-card-new");
  });
});
