// B4 跑团 · 续玩层交互（input/choices/明骰内联/generating/error）——期望来自 overview §B4 + play.html。
// 期望续玩层态（底部当前交互）：play-input（常驻输入框）/ play-choices（浮在输入框上方·非独占·无 own）/ play-rollreq（居中掷骰按钮）/ play-generating / play-error / play-postmortem-input。
// 明骰流程内联 stream：play-roll-bands 区间分档 1-3/4-6/7-9/0（不带剧透）+ 居中 play-roll-btn + 投出后 play-dice-result（命中档高亮·无弹窗）。
// 真前端现状：无这些原型 testid → 首跑必红。

import { test, expect } from "@playwright/test";
import {
  ROUTE,
  byTestid,
  expectTestidVisible,
  waitForBackend,
} from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · 续玩层交互", () => {
  let sessionId: string;
  test.beforeAll(async () => {
    await waitForBackend();
    ({ sessionId } = await seedPlaySession());
  });

  test("常驻输入框", async ({ page }) => {
    await page.goto(ROUTE.playSession(sessionId));
    // 期望：play-input 常驻输入框（续玩层默认态）。
    await expectTestidVisible(page, "play-input");
  });

  test("choices 浮在输入框上方 · 非独占 · 无 own", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#s=choices`);
    // 期望：play-choices 浮在输入框上方（非独占）· play-choices-hint 示单/多选 · 选项 toggle 选中/取消 · 点 send 提交（无 own·输入框即自定义入口）。
    await expectTestidVisible(page, "play-choices");
    await expectTestidVisible(page, "play-choices-hint");
    // 期望：choices 出现时 input 仍在（非独占）。
    await expectTestidVisible(page, "play-input");
  });

  test("明骰内联 stream：区间分档 + 居中掷骰按钮 + 投出结果", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#s=roll`);
    // 期望：play-roll-bands 区间分档 1-3/4-6/7-9/0（AI narrate·不带剧透）+ 居中醒目 play-roll-btn 大按钮 + 投出后 play-dice-result 简化结果内联（命中档高亮·无弹窗）。
    await expectTestidVisible(page, "play-roll-bands");
    await expectTestidVisible(page, "play-roll-btn");
    await expectTestidVisible(page, "play-dice-result");
  });

  test("待掷居中按钮（rollreq）", async ({ page }) => {
    await page.goto(`${ROUTE.playSession(sessionId)}#s=roll`);
    // 期望：play-rollreq 居中醒目掷骰按钮（与 roll-bands 内联 stream 配合）。
    await expectTestidVisible(page, "play-rollreq");
  });

  test("生成中 + 错误态", async ({ page }) => {
    // 期望：play-generating（生成中）/ play-error（错误态）。
    await page.goto(`${ROUTE.playSession(sessionId)}#s=generating`);
    await expectTestidVisible(page, "play-generating");
    await page.goto(`${ROUTE.playSession(sessionId)}#s=error`);
    await expectTestidVisible(page, "play-error");
  });
});
