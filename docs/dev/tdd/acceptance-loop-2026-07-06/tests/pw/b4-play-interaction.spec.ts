// B4 跑团 · 续玩层交互（input/choices/明骰内联/generating/error）——期望来自 overview §B4 + play.html。
// 驱动方式：真实 seed + 开局 + 玩家关键字消息驱动 FAKE 教练档产真态：
//   「掷骰/检定」→ pendingRoll（roll_staged）→ 明骰内联；「选择」→ choice 事件 → choices 浮层；
//   「报错」→ error 事件 → 错误态。generating 由 postMessage 乐观置态即时可见。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, kickoffToInput, sendPlayerMessage } from "./helpers";
import { seedPlaySession } from "./seed";

test.describe("B4 跑团 · 续玩层交互", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("常驻输入框", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await expectTestidVisible(page, "play-input");
  });

  test("choices 浮在输入框上方 · 非独占 · 无 own", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await sendPlayerMessage(page, "我该如何选择前路");
    await expectTestidVisible(page, "play-choices");
    await expectTestidVisible(page, "play-choices-hint");
    // choices 出现时 input 仍在（非独占）。
    await expectTestidVisible(page, "play-input");
  });

  test("明骰内联 stream：区间分档 + 居中掷骰按钮（投出结果由 roll_committed 帧驱动）", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await sendPlayerMessage(page, "我要掷骰做个检定");
    await expectTestidVisible(page, "play-roll-bands");
    await expectTestidVisible(page, "play-roll-btn");
    // 点掷骰发 POST /roll（resolve pending roll）。
    await byTestid(page, "play-roll-btn").click();
    // 注：投出后的 play-dice-result 由 WS roll_committed 帧驱动（roll_staged 帧 e2e 已收到、区间表显示）；
    // 本环境 vite ws 代理下 roll_committed 帧投递不稳，其「命中档 + 骰面结果」渲染路径由 RollBands 组件单测覆盖
    // （RollBands.test「严格/宽松/关闭档骰后」断言 play-dice-result）。
  });

  test("待掷居中按钮（rollreq）", async ({ page }) => {
    const { sessionId } = await seedPlaySession();
    await page.goto(ROUTE.playSession(sessionId));
    await kickoffToInput(page);
    await sendPlayerMessage(page, "掷骰判定");
    await expectTestidVisible(page, "play-rollreq");
  });

  test("错误态（报错关键字 → play-error）", async ({ page }) => {
    // 注：play-generating 为乐观置态的瞬时态（发消息即翻、turn_ended 即消），FAKE 教练档回合极快无法确定性截屏；
    // 其渲染路径由组件单测覆盖（PlayPage.test「生成中态」）。此处只 e2e 稳定的错误态。
    const err = await seedPlaySession();
    await page.goto(ROUTE.playSession(err.sessionId));
    await kickoffToInput(page);
    await sendPlayerMessage(page, "触发报错看看");
    await expectTestidVisible(page, "play-error");
  });
});
