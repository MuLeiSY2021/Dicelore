// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PlayPage from "./PlayPage.js";
import { useSession } from "./useSession.js";
import type { PresentationSnapshot, SessionConfig } from "@dicelore/shared";
import type { UsageReport } from "./api.js";

vi.mock("./useSession.js", () => ({ useSession: vi.fn() }));
vi.mock("@/features/play/api.js", () => ({
  browse: vi.fn().mockResolvedValue([]),
  listSessions: vi.fn().mockResolvedValue([{ sessionId: "demo", kind: "dicegm", status: "active", title: "黑风寨的钟声", packName: "黑风寨的钟声", started: true }]),
}));

const snap: PresentationSnapshot = {
  protocol: "dicelore.client/1", sessionId: "demo", seq: 5,
  sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }, { attr: "潜行", value: "+4", visible: 1 }] }],
  mechanics: [], choices: null, narrativeCursor: 1, pendingRoll: null,
  plotlines: [{ id: "夺图", title: "夺图", status: "进行中" }],
  foreshadows: [], lore: [{ name: "黑风寨", content: "依山临崖", category: "据点" }],
};
const config: SessionConfig = { model: "claude-sonnet-5", spoilerTier: "strict" };
const usage: UsageReport = { model: "claude-sonnet-5", contextTokens: 84000, contextWindow: 200000, contextPct: 0.42, sessionTotal: 12400, perTurn: [{ turnId: "t1", inputTokens: 3200, outputTokens: 480, cacheReadTokens: 0, cacheCreationTokens: 0 }] };

function mockSession(over: Partial<ReturnType<typeof useSession>> = {}) {
  (useSession as Mock).mockReturnValue({
    snapshot: snap, rounds: [{ texts: ["夜色如墨。"] }], narration: ["夜色如墨。"], pendingRoll: null, rollResult: null, hiddenRolls: [],
    generating: false, error: null, errorCode: null, gameEnd: null, reveals: [], config, usage, compacting: false,
    postMessage: vi.fn().mockResolvedValue({ turnId: "t" }), start: vi.fn().mockResolvedValue({ turnId: "t" }),
    roll: vi.fn().mockResolvedValue({ turnId: "t" }), choose: vi.fn().mockResolvedValue({ turnId: "t" }),
    rewind: vi.fn().mockResolvedValue({ snapshotId: 1 }), retry: vi.fn().mockResolvedValue(undefined), skip: vi.fn(),
    dismissReveal: vi.fn(), setModel: vi.fn().mockResolvedValue(config), setSpoilerTier: vi.fn().mockResolvedValue(config),
    branch: vi.fn().mockResolvedValue({ branchId: "b" }), refetchUsage: vi.fn(),
    ...over,
  });
}
const renderPlay = () => render(<MemoryRouter initialEntries={["/play/demo"]}><PlayPage /></MemoryRouter>);

it("桌面沙盘壳齐全：stagebar(model 切换) + stream + dock + ctx-bar + bay 按钮", () => {
  mockSession();
  renderPlay();
  expect(screen.getByTestId("play-stage-shell")).toBeInTheDocument();
  expect(screen.getByTestId("play-model-switch")).toBeInTheDocument();
  expect(screen.getByTestId("play-stream")).toBeInTheDocument();
  expect(screen.getByTestId("play-dock-right")).toBeInTheDocument();
  expect(screen.getByTestId("play-context-usage")).toBeInTheDocument();
  expect(screen.getByTestId("play-bay-btn-usage")).toBeInTheDocument();
  expect(screen.getByText("夜色如墨。")).toBeInTheDocument();
});

it("input 态：显示输入框，回车发送调 postMessage", () => {
  const postMessage = vi.fn().mockResolvedValue({ turnId: "t" });
  mockSession({ postMessage });
  renderPlay();
  const input = screen.getByLabelText("输入");
  fireEvent.change(input, { target: { value: "翻墙进去" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(postMessage).toHaveBeenCalledWith("翻墙进去");
});

it("roll 态：foot 出居中丢骰子按钮，点击调 roll", () => {
  const roll = vi.fn().mockResolvedValue({ turnId: "t" });
  mockSession({ pendingRoll: { eventId: 7, shape: "outcome", label: "割绳", yourSide: { name: "你", exprDisplay: "d10" }, bands: [{ label: "成功", min: 4, max: 6, plan: "割断", narration: "钟声哑了" }] }, roll });
  renderPlay();
  expect(screen.getByTestId("play-roll-bands")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("play-roll-btn"));
  expect(roll).toHaveBeenCalledWith(7);
});

it("choices 态：浮层选项 toggle 选中 + send 提交 choose", () => {
  const choose = vi.fn().mockResolvedValue({ turnId: "t" });
  mockSession({ snapshot: { ...snap, choices: { eventId: 9, options: [{ index: 0, label: "推门直入", consequence: "惊动守卫" }] } }, choose });
  renderPlay();
  const choicesBox = screen.getByTestId("play-choices");
  fireEvent.click(within(choicesBox).getByText("推门直入"));
  fireEvent.click(within(screen.getByTestId("play-input")).getByRole("button"));
  expect(choose).toHaveBeenCalledWith(9, 0);
});

it("暗骰 mech：严格档只显「进行了判定」隐结果；关闭档显完整结果", () => {
  const hr = [{ eventId: 3, label: "潜行", result: 18, dc: 12, band: { label: "成功", consequence: "未被发现" } }];
  mockSession({ hiddenRolls: hr, config: { model: "m", spoilerTier: "strict" } });
  const { rerender } = renderPlay();
  expect(screen.getByTestId("play-hidden-roll")).toHaveTextContent("进行了一次潜行判定");
  expect(screen.getByTestId("play-hidden-roll")).not.toHaveTextContent("18");
  mockSession({ hiddenRolls: hr, config: { model: "m", spoilerTier: "off" } });
  rerender(<MemoryRouter initialEntries={["/play/demo"]}><PlayPage /></MemoryRouter>);
  expect(screen.getByTestId("play-hidden-roll")).toHaveTextContent("18");
});

it("终局复盘态：不遮罩、endmark + 复盘输入框 + 分支回档", () => {
  const branch = vi.fn().mockResolvedValue({ branchId: "b" });
  mockSession({ gameEnd: { reason: "钟绳断落", outcome: "成功脱身" }, branch });
  renderPlay();
  expect(screen.getByTestId("play-endmark")).toBeInTheDocument();
  expect(screen.getByTestId("play-postmortem-input")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("play-branch"));
  expect(branch).toHaveBeenCalled();
});

it("turn-usage 内联：有 usage 的回合显 token+估价", () => {
  mockSession({ rounds: [{ texts: ["夜。"], usage: { inputTokens: 3200, outputTokens: 480, cacheReadTokens: 0, cacheCreationTokens: 0 }, model: "claude-sonnet-5" }] });
  renderPlay();
  expect(screen.getByTestId("play-turn-usage")).toHaveTextContent("3.2k");
});

it("dock-card 渲染 sheet 派生卡（角色 · 张三）", () => {
  mockSession();
  renderPlay();
  const dock = screen.getByTestId("play-dock-right");
  expect(within(dock).getByTestId("play-card-status:张三")).toBeInTheDocument();
  expect(within(dock).getByTestId("play-card-status:张三")).toHaveTextContent("HP: 12");
});

it("model 切换：select 变更调 setModel（下回合生效）", () => {
  const setModel = vi.fn().mockResolvedValue(config);
  mockSession({ setModel });
  renderPlay();
  fireEvent.change(screen.getByLabelText("切换模型"), { target: { value: "claude-opus-4-8" } });
  expect(setModel).toHaveBeenCalledWith("claude-opus-4-8");
});

it("ctx-bar：>90% 变红 + 即将触发压缩提示", () => {
  mockSession({ usage: { ...usage, contextPct: 0.93 } });
  renderPlay();
  expect(screen.getByTestId("play-context-hint")).toBeInTheDocument();
});

it("压缩进行时显 play-context-compacting + indeterminate 进度条", () => {
  mockSession({ compacting: true });
  renderPlay();
  expect(screen.getByTestId("play-context-compacting")).toBeInTheDocument();
  expect(screen.getByTestId("play-context-progress")).toBeInTheDocument();
});

it("RT-1：gm_timeout 显示重试/跳过；点击调 retry/skip", () => {
  const retry = vi.fn().mockResolvedValue(undefined);
  const skip = vi.fn();
  mockSession({ error: "GM 超时", errorCode: "gm_timeout", retry, skip });
  renderPlay();
  expect(screen.getByTestId("gm-timeout")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("timeout-retry"));
  expect(retry).toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("timeout-skip"));
  expect(skip).toHaveBeenCalled();
});

it("bay config popover：防剧透档切换调 setSpoilerTier", () => {
  const setSpoilerTier = vi.fn().mockResolvedValue(config);
  mockSession({ setSpoilerTier });
  renderPlay();
  fireEvent.click(screen.getByTestId("play-bay-btn-config"));
  fireEvent.click(screen.getByTestId("play-spoiler-off"));
  expect(setSpoilerTier).toHaveBeenCalledWith("off");
});
