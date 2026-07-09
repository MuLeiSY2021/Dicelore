// B5 团本制作 · 壳与布局——期望来自 overview §B5 + 原型 build.html。
// 期望：无顶栏 sessionbar（会话切换进 bay）+ build-ctxbar（团本名+草稿版本+校验/导入/导出）+ 左导航 build-nav-{13 内容类型} + 中央 build-editor（build-editor-title）+ 右栏 assistant/validate。
//   flex 滚动（bbody calc 视口 + 子项 flex:none + min-height:0·对齐 play）。
// 真前端现状：BuildPage 无这些原型 testid → 首跑必红。路由：/build。

import { test, expect } from "@playwright/test";
import { ROUTE, expectTestidVisible, waitForBackend } from "./helpers";

test.describe("B5 制作 · 壳与布局", () => {
  test.beforeAll(async () => {
    await waitForBackend();
  });

  test("无顶栏 sessionbar + 上下文条 ctxbar", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-ctxbar（团本名 + 草稿版本 + 校验/导入/导出）；无顶栏 sessionbar（会话切换进 bay）。
    await expectTestidVisible(page, "build-ctxbar");
  });

  test("左导航 13 内容类型", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-nav-{lore,npc,pool,rule,state,front,plotline,foreshadow,anchor,relation,prologue,manifest,materials}。
    for (const t of [
      "lore",
      "npc",
      "pool",
      "rule",
      "state",
      "front",
      "plotline",
      "foreshadow",
      "anchor",
      "relation",
      "prologue",
      "manifest",
      "materials",
    ]) {
      await expectTestidVisible(page, `build-nav-${t}`);
    }
  });

  test("中央编辑器 + 标题", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-editor（中央）+ build-editor-title。
    await expectTestidVisible(page, "build-editor");
    await expectTestidVisible(page, "build-editor-title");
  });

  test("ctxbar 动作：校验/导入/导出/提交 拆分", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-validate-btn / build-import-btn / build-export-btn / build-commit-btn（提交版本到库 vs 导出 Pack 拆分·A3/A4）。
    await expectTestidVisible(page, "build-validate-btn");
    await expectTestidVisible(page, "build-import-btn");
    await expectTestidVisible(page, "build-export-btn");
    await expectTestidVisible(page, "build-commit-btn");
  });
});
