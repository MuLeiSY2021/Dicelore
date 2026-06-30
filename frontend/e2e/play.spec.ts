// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { test, expect, type Page } from "@playwright/test";

// 端到端「造团本 → 开局 → 玩」闭环 + 五条玩家主线(掷骰/选择/终局/错误恢复/断线重连)。
//
// 前置:backend 起在 :8787 且 DICELORE_FAKE_GM=1(脚本化 GM,不烧 LLM);vite dev 由 webServer 拉起。
//   DICELORE_FAKE_GM=1 PORT=8787 npx tsx backend/src/server.ts
//
// ⚠️ 运行说明(follow-up):
//   1) 本机 Playwright chromium 浏览器未安装(~100MB 未下载),五条 spec 本地未跑通,仅写好待 CI/装浏览器后跑。
//      装:`npx playwright install chromium`。
//   2) 掷骰/选择/终局三条主线需要服务端 FAKE_GM 能按玩家输入产 pending_roll / pending_choice / game_end。
//      FakeDiceGm 已具备「教练档」能力(canon 动作:roll/choice/gameEnd,见 dice/FakeDiceGm.ts + 其单测),
//      但 server.ts 默认工厂目前仍是「纯叙事档」(只产 narration)。要让这三条 e2e 跑通,
//      需在 server.ts 把 FAKE_GM 工厂接成教练档(按 input.text 关键词产对应 canon 动作)——
//      此改动落在 server.ts(本测试线 owns 之外),标为 follow-up。届时去掉对应 test 的 .fixme 即可。
//   后端集成层的五条主线已由 dice/FakeDiceGm.test.ts(经真 DiceSession+WsHub)端到端覆盖;
//   前端 hook/client 层已由 live/useSession.test.tsx + api/client.test.ts 覆盖。本文件补浏览器层。

// 造示例团本并开局 → 跳到跑团页,返回 sessionId 段。
async function quickPlay(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("quick-play").click();
  await expect(page).toHaveURL(/\/play\/s-[0-9a-f]{8}/);
}

test("造示例团本 → 开局 import → 跑一回合 → 看到导入态与叙事", async ({ page }) => {
  await quickPlay(page);

  // 呈现台显示导入的开局态(旅人 HP 12)
  const stage = page.getByLabel("呈现台");
  await expect(stage.getByText("旅人", { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(stage.getByText("12", { exact: true })).toBeVisible();

  // 开场层：未开场 → 大金「点击开始游戏」按钮(非输入框)。点它 kickoff → FAKE GM 流式开场。
  await expect(page.getByTestId("kickoff")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("kickoff").click();
  await expect(page.locator(".narr p").filter({ hasText: /门吱呀一声开了|你说/ })).toBeVisible({ timeout: 10_000 });
  // 开场后进入续玩层：输入框出现
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });
});

// ── 主线①：掷骰 ─────────────────────────────────────────────────────────────
// 需服务端 FAKE_GM 教练档(产 pending_roll)。见顶部运行说明②。
test.fixme("主线① 掷骰:GM 起明骰 → 待掷卡出现 → 玩家点掷 → 待掷卡消失、回合推进", async ({ page }) => {
  await quickPlay(page);
  await page.getByTestId("kickoff").click();
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });

  // 玩家输入触发一个明骰检定(教练档据关键词产 resolve_outcome_open)。
  await page.getByLabel("输入").fill("我要翻越高墙");
  await page.getByLabel("输入").press("Enter");

  // 待掷卡(roll_staged)出现:呈现台 .ranges 档位 + 输入区出现「掷骰」按钮。
  await expect(page.locator(".ranges .rt")).toBeVisible({ timeout: 10_000 });
  const rollBtn = page.locator("button.roll").filter({ hasText: /掷骰|Roll/i });
  await expect(rollBtn).toBeVisible();

  // 玩家点掷 → roll_committed → 待掷卡消失、输入框回归(回合推进)。
  await rollBtn.click();
  await expect(rollBtn).toBeHidden({ timeout: 10_000 });
  await expect(page.getByLabel("输入")).toBeVisible();
});

// ── 主线②：选择 ─────────────────────────────────────────────────────────────
// 需服务端 FAKE_GM 教练档(产 pending_choice)。见顶部运行说明②。
test.fixme("主线② 选择:回合末出选项 → 玩家点一项 → 选项锁定、下一回合据此推进", async ({ page }) => {
  await quickPlay(page);
  await page.getByTestId("kickoff").click();
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("输入").fill("我环顾四周找路");
  await page.getByLabel("输入").press("Enter");

  // 选项(choices)出现:两个 .choice 按钮。
  const choiceBtns = page.locator("button.choice");
  await expect(choiceBtns).toHaveCount(2, { timeout: 10_000 });

  // 点第 2 项 → choose → 该项标记 sel、所有选项禁用(防重复提交)。
  await choiceBtns.nth(1).click();
  await expect(choiceBtns.nth(1)).toHaveClass(/sel/);
  await expect(choiceBtns.first()).toBeDisabled();
});

// ── 主线③：终局(game_end) ───────────────────────────────────────────────────
// 需服务端 FAKE_GM 教练档(产 game_end)。见顶部运行说明②。
test.fixme("主线③ 终局:GM 发 game_end → 终局横幅出现 → 输入框锁定(不可再操作)", async ({ page }) => {
  await quickPlay(page);
  await page.getByTestId("kickoff").click();
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("输入").fill("我冲向巨龙拼死一搏");
  await page.getByLabel("输入").press("Enter");

  // 终局横幅(div.end[role=status]):含结局 outcome + 原因 reason。
  const endBanner = page.locator(".narr .end[role=status]");
  await expect(endBanner).toBeVisible({ timeout: 10_000 });
  // 输入框终局锁:disabled。
  await expect(page.getByLabel("输入")).toBeDisabled();
});

// ── 主线④：错误恢复 ─────────────────────────────────────────────────────────
// 错误提示(div.err)的呈现可不依赖教练档:断后端连接发请求 → 动作失败 → err 出现。
// 但稳定触发需服务端配合(如 409/500),先标 fixme 待 CI 接通后端可控错误。见顶部运行说明②。
test.fixme("主线④ 错误恢复:动作失败 → 错误条出现 → 重试后错误清除、正常推进", async ({ page }) => {
  await quickPlay(page);
  await page.getByTestId("kickoff").click();
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });

  // (教练档/可控错误)触发一次会失败的动作 → 错误条(div.err)出现。
  await page.getByLabel("输入").fill("[触发GM错误]");
  await page.getByLabel("输入").press("Enter");
  await expect(page.locator(".narr .err")).toBeVisible({ timeout: 10_000 });

  // 重试一个正常输入 → turn_started 清旧错误 → 错误条消失、叙事推进。
  await page.getByLabel("输入").fill("我换个法子");
  await page.getByLabel("输入").press("Enter");
  await expect(page.locator(".narr .err")).toBeHidden({ timeout: 10_000 });
});

// ── 主线⑤：断线重连 ─────────────────────────────────────────────────────────
// 重连本身不依赖教练档:可通过 page.context().setOffline 切断网络再恢复,
// 验证 useSession 退避重连 + refetch 对账后页面仍可用。但需浏览器跑,标 fixme 待装 chromium。
test.fixme("主线⑤ 断线重连:切断网络 → 恢复后 WS 重连 + 快照对账,页面仍可继续玩", async ({ page }) => {
  await quickPlay(page);
  await page.getByTestId("kickoff").click();
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });

  // 记录开场叙事(重连后应仍在,不丢)。
  const firstNarr = await page.locator(".narr p").first().textContent();

  // 切断网络 → WS onclose → useSession 进入退避重连。
  await page.context().setOffline(true);
  await page.waitForTimeout(1000);
  // 恢复网络 → 重连成功 + refetch 全量对账。
  await page.context().setOffline(false);

  // 重连后页面仍可用:输入框仍在、开场叙事未丢(快照/重放对账)。
  await expect(page.getByLabel("输入")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".narr p").filter({ hasText: firstNarr ?? "" })).toBeVisible({ timeout: 10_000 });

  // 重连后仍能发新回合(连接确实恢复)。
  await page.getByLabel("输入").fill("重连后我继续探索");
  await page.getByLabel("输入").press("Enter");
  await expect(page.locator(".narr p")).toHaveCount(2, { timeout: 10_000 });
});
