// B5 制作 · 助手对话 + 编排态——期望来自 overview §B5 + build.html。
// 驱动方式：真实 seed loregm + 从构建助手发指令 → FAKE 构建档调 build 工具（WS toolcall）+ 写 Draft。
//   build-assistant/toolcalls/generating/tools/cancel 经真回合驱动。
//
// 放宽并注明（经作者裁决 · FAKE 构建档不产该信号）：
//  · build-assistant-error：需 loregm 回合领域级出错（D3 body.error）；FAKE 默认脚本不产 error。渲染路径已就位（displayErr→build-assistant-error）。
//  · build-turn-usage：需 loregm messages 回 usage（usage-stream）；FAKE 不回 usage。渲染路径已就位（chat 项有 usage 即出）。

import { test, expect } from "./fixtures";
import { ROUTE, byTestid, expectTestidVisible, waitForBackend, sendBuildMessage } from "./helpers";
import { freshLoreSession } from "./seed";

test.describe("B5 制作 · 助手与编排态", () => {
  test.beforeAll(async () => { await waitForBackend(); });

  test("助手对话 + toolcalls 可见", async ({ page }) => {
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await expectTestidVisible(page, "build-assistant");
    await sendBuildMessage(page, "帮我起个武侠团本骨架");
    // FAKE 构建档调 set_manifest/write_lore… → WS toolcall → 助手消息尾行显示调了哪些工具。
    await expect(byTestid(page, "build-assistant-toolcalls").first()).toBeVisible({ timeout: 15_000 });
  });

  test("发指令 → 助手回执（编排中 spinner/流式 toolcall/中止 = 瞬时态·组件单测覆盖）", async ({ page }) => {
    // 注：build-generating/tools/cancel 是回合进行中的瞬时态，FAKE 构建档回合极快无法确定性截屏；
    // 其渲染路径由组件单测覆盖（BuildPage.test「编排中态」）。此处 e2e 验发指令得回执。
    await freshLoreSession();
    await page.goto(ROUTE.build);
    await expectTestidVisible(page, "build-assistant");
    const box = page.locator(".cin .box");
    await box.fill("再补一段世界观设定");
    await byTestid(page, "build-send").click();
    await expect(byTestid(page, "build-assistant").first()).toContainText("已处理", { timeout: 15_000 });
  });
});
