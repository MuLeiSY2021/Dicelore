// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage.js";

// HomePage 重构为原型 IA：指南 + 最近一个会话摘要卡 + 首访空态 + 快速入口 + 角落运行态。
// useHealth 内部 fetch health（离线安全）；这里 mock 掉网络避免噪声。
vi.mock("@/shell/useHealth.js", () => ({ useHealth: () => ({ health: null, offline: true }) }));

function mount() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

it("渲染指南 + 使用手册链接（核心）", () => {
  mount();
  expect(screen.getByTestId("home-guide")).toBeInTheDocument();
  expect(screen.getByTestId("home-manual-link")).toBeInTheDocument();
});

it("最近一个会话摘要卡（恰一个）+ 继续按钮", () => {
  mount();
  expect(screen.getAllByTestId("home-recent-session")).toHaveLength(1);
  expect(screen.getByTestId("home-recent-continue")).toBeInTheDocument();
});

it("首访空态强 CTA 始终可见 + 三快速入口 + 角落运行态", () => {
  mount();
  expect(screen.getByTestId("home-start-cta")).toBeInTheDocument();
  for (const q of ["catalog", "build", "config"]) {
    expect(screen.getByTestId(`home-quick-${q}`)).toBeInTheDocument();
  }
  expect(screen.getByTestId("home-runstatus")).toBeInTheDocument();
});
