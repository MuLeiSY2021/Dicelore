// B4 跑团 · bay 入口/数据浏览 + 运行时观测族——期望来自 overview §B4 + play.html。
// 期望 bay 专属入口（app-bay-nav 之外）：play-bay-btn-{session,chara,plotline,world,forms,config,archive,usage} 点击在屏幕中央弹 play-bay-popover-{...}。
//   团数据四类 = 数据浏览：play-bay-popover-{chara,plotline,world,forms}（play-data-entry 展开·非卡模板+钉选·对齐后端 sheets entity→cell）。
//   play-bay-popover-config 含防剧透 + play-observe-toggle 透视 GM 动作。
//   play-bay-popover-session：play-session-item（play-session-date/play-session-lastreply）。
// 运行时观测族（期望态·依赖未批准裁决·红态）：play-model-switch（RT-FE18）/ play-context-usage+play-context-hint+play-context-dial（RT-FE14）/ play-turn-usage（RT-FE16）/ play-bay-popover-usage（RT-FE14/16/17）。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import {
  ROUTE,
  byTestid,
  expectTestidVisible,
  waitForBackend,
} from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · bay 入口与运行时观测族", () => {
  let sessionId: string;
  test.beforeAll(async () => {
    await waitForBackend();
    ({ sessionId } = await seedPlaySession());
  });

  test("bay 专属入口八按钮", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#baybar=show`);
    // 期望：play-bay-btn-{session,chara,plotline,world,forms,config,archive,usage}。
    for (const t of [
      "session",
      "chara",
      "plotline",
      "world",
      "forms",
      "config",
      "archive",
      "usage",
    ]) {
      await expectTestidVisible(page, `play-bay-btn-${t}`);
    }
  });

  test("团数据四类 = 数据浏览（play-data-entry 展开）", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#bay=chara`);
    // 期望：play-bay-popover-{chara,plotline,world,forms} 数据浏览，每条 play-data-entry 可展开看 cell。
    await expectTestidVisible(page, "play-bay-popover-chara");
    await expectTestidVisible(page, "play-data-entry");
  });

  test("bay-config：防剧透 + 透视 GM 动作 toggle", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#bay=config`);
    // 期望：play-bay-popover-config 含防剧透（严格/宽松/关闭）+ play-observe-toggle 透视 GM 动作（控制 play-stream.show-actions 显隐 toolcall）。
    await expectTestidVisible(page, "play-bay-popover-config");
    await expectTestidVisible(page, "play-observe-toggle");
  });

  test("bay-session：会话列表 + 日期 + 最近回复", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#bay=session`);
    // 期望：play-bay-popover-session 列 play-session-item（play-session-date/play-session-lastreply · RT9 最新回复字段待验）。
    await expectTestidVisible(page, "play-bay-popover-session");
    await expectTestidVisible(page, "play-session-item");
    await expectTestidVisible(page, "play-session-date");
    await expectTestidVisible(page, "play-session-lastreply");
  });

  test("运行时观测族 · model 运行时切换（RT-FE18 · 红态）", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：play-model-switch（stagebar 中段·model 切换下拉·当前 currentModel 高亮·下回合生效）← 依赖未批准裁决 model-switch。
    await expectTestidVisible(page, "play-model-switch");
  });

  test("运行时观测族 · 上下文占用条（RT-FE14 · 红态）", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#ctx=danger`);
    // 期望：play-context-usage（foot 下方常驻占用条·contextPct + 进度条·>90% 变红）+ play-context-hint「即将触发压缩」+ play-context-dial 百分比圆盘。
    await expectTestidVisible(page, "play-context-usage");
    await expectTestidVisible(page, "play-context-hint");
    await expectTestidVisible(page, "play-context-dial");
  });

  test("运行时观测族 · 回合块尾 turn-usage（RT-FE16 · 红态）", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：play-turn-usage（stream 回合块尾内联 ⟨model·↑↓tok·≈$⟩·hover 展开四类明细·无 usage 不渲染）。
    await expectTestidVisible(page, "play-turn-usage");
  });

  test("运行时观测族 · 用量详情浮窗（RT-FE14/16/17 · 红态）", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#bay=usage`);
    // 期望：play-bay-popover-usage（session 累计 / 各 MCP 工具消耗分项 / 记忆占用分项 / 上下文占用 / per-turn 各轮列表）。MCP/记忆分项为前端冒出的超前数据需求（裁决 GET /usage 未含·待批准）。
    await expectTestidVisible(page, "play-bay-popover-usage");
  });
});
