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
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import { TopBar } from "./shell/TopBar.js";
import HomePage from "./pages/HomePage.js";
import PlayPage from "./pages/PlayPage.js";

vi.mock("./api/client.js", () => ({ listSessions: vi.fn().mockResolvedValue([]) }));
vi.mock("./live/useSession.js", () => ({
  useSession: () => ({ snapshot: null, narration: [], pendingRoll: null, postMessage: vi.fn(), roll: vi.fn() }),
}));

function tree(initial: string) {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<><TopBar /><Outlet /></>}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

it("bar 渲染四个页面导航 + 品牌", () => {
  render(tree("/"));
  expect(screen.getByText(/Dicelore/)).toBeInTheDocument();
  for (const label of ["主页", "跑团", "团本制作", "配置"]) {
    // 精确名只匹配导航链接(主页的 quick 卡片可访问名含描述,不精确匹配)
    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  }
});

it("主页路由渲染主页壳", () => {
  render(tree("/"));
  expect(screen.getByText("欢迎回到案上")).toBeInTheDocument();
});

it("/play 路由渲染跑团三栏(活动轨 + 呈现台)", () => {
  render(tree("/play"));
  expect(screen.getByLabelText("活动轨")).toBeInTheDocument();
  expect(screen.getByLabelText("呈现台")).toBeInTheDocument();
});
