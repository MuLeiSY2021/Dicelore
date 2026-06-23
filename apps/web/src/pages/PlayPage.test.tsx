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
    snapshot: snap, narration: [], pendingRoll: null, generating: false, error: null, gameEnd: null, reveals: [],
    postMessage: vi.fn().mockResolvedValue({ turnId: "t" }), roll: vi.fn().mockResolvedValue({ turnId: "t" }),
    choose: vi.fn().mockResolvedValue({ turnId: "t" }), dismissReveal: vi.fn(),
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
