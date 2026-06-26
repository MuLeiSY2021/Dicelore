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
import { I18nProvider } from "./i18n/index.js";
import { SettingsProvider } from "./settings/useSettings.js";
import { TopBar } from "./shell/TopBar.js";
import HomePage from "./pages/HomePage.js";
import PlayPage from "./pages/PlayPage.js";

vi.mock("./api/client.js", () => ({
  listSessions: vi.fn().mockResolvedValue([{ sessionId: "demo", title: "demo", status: "active" }]),
  getHealth: vi.fn().mockResolvedValue({
    protocol: "dicelore.client/1", fakeGm: true, port: 8787,
    model: { gm: "fake-gm", configured: true, baseUrl: null },
    mcp: { name: "dicelore", transport: "in-process", toolCount: 20, running: true },
    notify: { url: null, configured: false }, storage: { sessionsDir: ".", ftsMode: "jieba" },
  }),
  commitPack: vi.fn(), openPlaySession: vi.fn(), browse: vi.fn().mockResolvedValue([]),
  startGame: vi.fn(), deleteSession: vi.fn(),
}));
vi.mock("./live/useSession.js", () => ({
  useSession: () => ({
    snapshot: null, narration: [], pendingRoll: null, generating: false, error: null, gameEnd: null, reveals: [],
    postMessage: vi.fn(), roll: vi.fn(), choose: vi.fn(), dismissReveal: vi.fn(),
  }),
}));

function tree(initial: string) {
  return (
    <I18nProvider><ThemeProvider><SettingsProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<><TopBar /><Outlet /></>}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SettingsProvider></ThemeProvider></I18nProvider>
  );
}

it("bar 渲染四个页面导航 + 品牌 logo", () => {
  render(tree("/"));
  expect(screen.getByLabelText("Dicelore")).toBeInTheDocument(); // 品牌 logo lockup
  for (const label of ["主页", "跑团", "团本制作", "配置"]) {
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
