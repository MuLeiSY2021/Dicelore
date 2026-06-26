// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PlayPage from "./PlayPage.js";
import { useSession } from "../live/useSession.js";
import type { PresentationSnapshot } from "@dicelore/shared";

vi.mock("../live/useSession.js", () => ({ useSession: vi.fn() }));
vi.mock("../api/client.js", () => ({
  browse: vi.fn().mockResolvedValue([]),
  listSessions: vi.fn().mockResolvedValue([]),
}));

const snap: PresentationSnapshot = {
  protocol: "dicelore.client/1", sessionId: "demo", seq: 5,
  sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] }],
  mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null,
};

function mockSession(over: Partial<ReturnType<typeof useSession>> = {}) {
  (useSession as Mock).mockReturnValue({
    snapshot: snap, narration: [], pendingRoll: null, generating: false, error: null, errorCode: null, gameEnd: null, reveals: [],
    postMessage: vi.fn().mockResolvedValue({ turnId: "t" }), start: vi.fn().mockResolvedValue({ turnId: "t" }),
    roll: vi.fn().mockResolvedValue({ turnId: "t" }),
    choose: vi.fn().mockResolvedValue({ turnId: "t" }), rewind: vi.fn().mockResolvedValue({ snapshotId: 1 }),
    retry: vi.fn().mockResolvedValue(undefined), skip: vi.fn(), dismissReveal: vi.fn(),
    ...over,
  });
}
const renderPlay = () => render(<MemoryRouter><PlayPage /></MemoryRouter>);

it("三栏壳齐全(活动轨/叙事/呈现台) + 呈现台渲染快照", () => {
  mockSession();
  renderPlay();
  expect(screen.getByLabelText("活动轨")).toBeInTheDocument();
  expect(screen.getByLabelText("叙事")).toBeInTheDocument();
  expect(screen.getByLabelText("呈现台")).toBeInTheDocument();
  expect(screen.getByText("张三", { exact: false })).toBeInTheDocument();
});

it("有叙事时渲染段落；无 pendingRoll 时显示输入框", () => {
  mockSession({ narration: ["门开了。"] });
  renderPlay();
  expect(screen.getByText("门开了。")).toBeInTheDocument();
  expect(screen.getByLabelText("输入")).toBeInTheDocument();
});

it("pendingRoll 非空时打字区换成掷骰卡", () => {
  mockSession({ pendingRoll: { eventId: 7, shape: "outcome", label: "撬锁", yourSide: { name: "你", exprDisplay: "1d100" }, bands: [] } });
  renderPlay();
  expect(screen.getByRole("button", { name: /丢骰子/ })).toBeInTheDocument();
});

it("有 choice 时渲染可点选项(闭环已接通)", () => {
  mockSession({ snapshot: { ...snap, choices: { eventId: 9, options: [{ index: 0, label: "推门", consequence: "惊动守卫" }] } } });
  renderPlay();
  expect(screen.getByRole("button", { name: /推门/ })).toBeEnabled();
});

it("已开场时显示读档入口；点击确认后调 rewind(SNAP-1 读档)", async () => {
  const rewind = vi.fn().mockResolvedValue({ snapshotId: 3 });
  mockSession({ narration: ["门开了。"], rewind });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderPlay();
  const btn = screen.getByTestId("rewind");
  expect(btn).toBeInTheDocument();
  btn.click();
  expect(rewind).toHaveBeenCalled();
});

it("未开场时不显示读档入口(v1 是存档/读档,跑过回合才有存档)", () => {
  mockSession({ narration: [], snapshot: { ...snap, narrativeCursor: 0 } });
  renderPlay();
  expect(screen.queryByTestId("rewind")).toBeNull();
});

it("RT-1：errorCode=gm_timeout 时显示重试/跳过入口；点击调 retry/skip", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const retry = vi.fn().mockResolvedValue(undefined);
  const skip = vi.fn();
  mockSession({ narration: ["门开了。"], error: "GM 回合超时(180s)中止,已脱困", errorCode: "gm_timeout", retry, skip });
  renderPlay();
  expect(screen.getByTestId("gm-timeout")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("timeout-retry"));
  expect(retry).toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("timeout-skip"));
  expect(skip).toHaveBeenCalled();
});

it("RT-1：普通错误(非 gm_timeout)仍走朴素错误条,不显示重试/跳过", () => {
  mockSession({ narration: ["门开了。"], error: "别的错误", errorCode: "gm_error" });
  renderPlay();
  expect(screen.queryByTestId("gm-timeout")).toBeNull();
  expect(screen.getByText("别的错误")).toBeInTheDocument();
});
