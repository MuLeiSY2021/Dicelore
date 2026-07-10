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
import HomePage from "./HomePage.js";
import { listSessions } from "@/features/play/api.js";
import type { SessionSummary } from "@dicelore/shared";

vi.mock("@/features/play/api.js", () => ({ listSessions: vi.fn() }));

function mount() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

const sessions: SessionSummary[] = [
  { sessionId: "demo", kind: "dicegm", title: "黄昏旅店", status: "active", packName: "黄昏旅店" },
  { sessionId: "old", kind: "dicegm", title: "旧档", status: "archived", packName: "旧档" },
];

it("挂载时拉取会话列表并渲染 session title", async () => {
  (listSessions as Mock).mockResolvedValue(sessions);
  mount();
  expect(listSessions).toHaveBeenCalled();
  expect((await screen.findAllByText("黄昏旅店")).length).toBeGreaterThan(0);
  expect(await screen.findByText("旧档")).toBeInTheDocument();
});

it("列表为空显示开新局提示", async () => {
  (listSessions as Mock).mockResolvedValue([]);
  mount();
  expect((await screen.findAllByText(/暂无会话/)).length).toBeGreaterThan(0);
});

it("拉取失败显示加载失败提示", async () => {
  (listSessions as Mock).mockRejectedValue(new Error("boom"));
  mount();
  expect(await screen.findByText(/加载失败/)).toBeInTheDocument();
});
