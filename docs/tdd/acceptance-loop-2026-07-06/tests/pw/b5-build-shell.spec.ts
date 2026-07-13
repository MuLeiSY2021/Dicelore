// B5 团本制作 · 壳与布局——期望来自 overview §B5 + 原型 build.html。
// 驱动方式：真实 seed（POST /sessions/loregm 建构建会话）→ BuildPage 自动选中 → active 屏。
// 无 hash：ctxbar/nav/editor 均来自 active 屏真结构。

import { test } from "./fixtures";
import { ROUTE, expectTestidVisible, waitForBackend } from "./helpers";
import { freshLoreSession } from "./seed";

test.describe("B5 制作 · 壳与布局", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("无顶栏 sessionbar + 上下文条 ctxbar", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await expectTestidVisible(page, "build-ctxbar");
  });

  test("左导航 13 内容类型", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await expectTestidVisible(page, "build-editor"); // 等 active 屏就位
    for (const t of [
      "lore", "npc", "pool", "rule", "state", "front", "plotline",
      "foreshadow", "anchor", "relation", "prologue", "manifest", "materials",
    ]) {
      await expectTestidVisible(page, `build-nav-${t}`);
    }
  });

  test("中央编辑器 + 标题", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await expectTestidVisible(page, "build-editor");
    await expectTestidVisible(page, "build-editor-title");
  });

  test("ctxbar 动作：校验/导入/导出/提交 拆分", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await expectTestidVisible(page, "build-validate-btn");
    await expectTestidVisible(page, "build-import-btn");
    await expectTestidVisible(page, "build-export-btn");
    await expectTestidVisible(page, "build-commit-btn");
  });
});
