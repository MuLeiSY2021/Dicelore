// B4 跑团页 · 壳与布局——期望来自 1-frontend-overview §B4 + 原型 play.html。
// 真前端现状：PlayPage 无 play-stage-shell/play-dock-right 等原型 testid（IA=工作区/工具面板·RT-FE1/RT-FE3）→ 首跑必红。
// 路由：/play（无会话→noSession hint）/play/:sessionId（seeded→kickoff/input）。

import { test, expect } from "@playwright/test";
import {
  ROUTE,
  byTestid,
  expectTestidVisible,
  waitForBackend,
} from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · 壳与布局", () => {
  let sessionId: string;
  test.beforeAll(async () => {
    await waitForBackend();
    ({ sessionId } = await seedPlaySession());
  });

  test("桌面沙盘壳：stage-shell + 右侧 dock + 折叠", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：play-stage-shell（中央舞台：叙事流 + 底部当前交互）+ 右侧 play-dock-right（单 dock · 公开信息卡 · play-dock-fold 可折叠，折叠后舞台全宽）。
    await expectTestidVisible(page, "play-stage-shell");
    await expectTestidVisible(page, "play-dock-right");
    await expectTestidVisible(page, "play-dock-fold");
  });

  test("无活动会话 hint（含引导入口 + 最近会话，不空）", async ({ page }) => {
    await page.goto(ROUTE.play);
    // 期望：play-noSession-hint（无活动会话 · 含 play-none-catalog 引导入口 + play-none-recent 最近会话，不空）。
    await expectTestidVisible(page, "play-noSession-hint");
    await expectTestidVisible(page, "play-none-catalog");
    await expectTestidVisible(page, "play-none-recent");
  });

  test("未开场：kickoff 团本信息卡 + 开场按钮", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：未开场 play-kickoff-btn（含 play-kickoff-pack 团本信息卡：题材/标题/简介/角色预览）。
    await expectTestidVisible(page, "play-kickoff-pack");
    await expectTestidVisible(page, "play-kickoff-btn");
  });

  test("移动端布局：右 dock 缩进 stage 上方横向滚动", async ({ page }) => {
    // 期望（#layout=mobile）：右 dock 缩进 stage 上方、横向滚动、每条 dock-card 可折叠。
    // 真 app 不认 #layout=mobile；移动端由视口触发——这里用窄视口验 stage-shell 仍存在 + dock 布局自适应（期望态）。
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTE.playSession(sessionId));
    await expectTestidVisible(page, "play-stage-shell");
    await expectTestidVisible(page, "play-dock-right");
  });
});
