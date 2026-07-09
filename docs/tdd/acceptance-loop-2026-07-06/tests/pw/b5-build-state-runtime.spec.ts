// B5 制作 · A3 域机态 + 运行时观测族 + materials/relation/guideline/card-edit——期望来自 overview §B5 + build.html。
// 期望 A3 域机态/交互：build-generating/build-assistant-error/build-exported/build-validate-ok/build-noSession-hint；build-bay-btn-usage → build-bay-popover-usage（构建 session 累计 / 各 MCP 工具消耗 / 记忆占用 / 上下文占用 build-context-dial / per-turn）。
//   build-import-btn → materials 视图（build-materials-drop/build-materials-list 流式上传·FE-build-upload 里程碑二）；build-nav-relation（关系图谱·a-prime §5 待裁决）；guideline 5 阶段 build-guideline-{source,world,npc,rule,manifest}；build-card-edit/build-card-del/build-card-new（inline 编辑全类型）。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import { ROUTE, expectTestidVisible, waitForBackend } from "./helpers";

test.describe("B5 制作 · 域机态与运行时观测族", () => {
  test.beforeAll(async () => {
    await waitForBackend();
  });

  test("运行时观测族 · 用量详情浮窗 + 上下文圆盘（RT-FE14/16/17 · 红态）", async ({ page }) => {
    await page.goto(`${ROUTE.build}#bay=usage`);
    // 期望：build-bay-btn-usage → build-bay-popover-usage（构建 session 累计 / 各 MCP 工具消耗 / 记忆占用 / 上下文占用 build-context-dial / per-turn）。对称 play·依赖未批准裁决。
    await expectTestidVisible(page, "build-bay-btn-usage");
    await expectTestidVisible(page, "build-bay-popover-usage");
    await expectTestidVisible(page, "build-context-dial");
  });

  test("materials 素材包视图：流式上传", async ({ page }) => {
    await page.goto(`${ROUTE.build}#v=materials`);
    // 期望：build-nav-materials + data-view=materials → build-materials-drop/build-materials-list（流式上传·FE-build-upload 里程碑二）。
    await expectTestidVisible(page, "build-materials-drop");
    await expectTestidVisible(page, "build-materials-list");
  });

  test("关系图谱视图", async ({ page }) => {
    await page.goto(`${ROUTE.build}#v=relation`);
    // 期望：build-nav-relation + data-view=relation（关系图谱·a-prime §5 待裁决）。
    await expectTestidVisible(page, "build-nav-relation");
  });

  test("guideline 5 阶段跳转", async ({ page }) => {
    await page.goto(ROUTE.build);
    // 期望：build-guideline-{source,world,npc,rule,manifest}（5 阶段 + data-goto 可点跳转对应 nav）。
    for (const t of ["source", "world", "npc", "rule", "manifest"]) {
      await expectTestidVisible(page, `build-guideline-${t}`);
    }
  });

  test("内容卡 inline 编辑全类型 + 新建", async ({ page }) => {
    await page.goto(`${ROUTE.build}#v=npc`);
    // 期望：build-card-edit / build-card-del（inline 编辑·全类型）/ build-card-new（mtool「新建」绑当前 nav 加新卡）。
    await expectTestidVisible(page, "build-card-edit");
    await expectTestidVisible(page, "build-card-del");
    await expectTestidVisible(page, "build-card-new");
  });
});
