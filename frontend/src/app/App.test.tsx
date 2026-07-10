// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "@/shared/theme/ThemeProvider.js";
import { I18nProvider } from "@/shared/i18n/index.js";
import { SettingsProvider } from "@/shared/settings/useSettings.js";
import { Bay } from "@/shell/Bay.js";
import HomePage from "@/features/home/HomePage.js";
import PlayPage from "@/features/play/PlayPage.js";

vi.mock("@/features/play/api.js", () => ({
  listSessions: vi.fn().mockResolvedValue([{ sessionId: "demo", title: "demo", status: "active" }]),
  browse: vi.fn().mockResolvedValue([]),
  startGame: vi.fn(), deleteSession: vi.fn(),
}));
vi.mock("@/features/catalog/api.js", () => ({
  commitPack: vi.fn(), createPlaySession: vi.fn(),
}));
vi.mock("@/shared/api/http.js", () => ({
  getHealth: vi.fn().mockResolvedValue({
    protocol: "dicelore.client/1", fakeGm: true, port: 8787,
    model: { gm: "fake-gm", configured: true, baseUrl: null },
    mcp: { name: "dicelore", transport: "in-process", toolCount: 20, running: true },
    notify: { url: null, configured: false }, storage: { sessionsDir: ".", ftsMode: "jieba" },
  }),
}));
vi.mock("@/features/play/useSession.js", () => ({
  useSession: () => ({
    snapshot: null, narration: [], pendingRoll: null, generating: false, error: null, gameEnd: null, reveals: [],
    postMessage: vi.fn(), roll: vi.fn(), choose: vi.fn(), dismissReveal: vi.fn(),
  }),
}));

// Shell 无顶栏：只留 <Outlet/> + 全局底部 <Bay/>（对齐 app/router.tsx 的 Shell）。
function tree(initial: string) {
  return (
    <I18nProvider><ThemeProvider><SettingsProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<><Outlet /><Bay /></>}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SettingsProvider></ThemeProvider></I18nProvider>
  );
}

afterEach(() => { document.body.className = ""; });

it("Shell 无顶栏、全局底部 app-bay 渲染五块 nav-tab", () => {
  render(tree("/"));
  // 顶栏已删除：不存在 header.bar
  expect(document.querySelector("header.bar")).toBeNull();
  expect(screen.getByTestId("app-bay")).toBeInTheDocument();
  for (const tab of ["home", "catalog", "play", "build", "config"]) {
    expect(screen.getByTestId(`nav-tab-${tab}`)).toBeInTheDocument();
  }
});

it("主页路由渲染主页壳", () => {
  render(tree("/"));
  expect(screen.getByText("欢迎回到案上")).toBeInTheDocument();
});

it("跑团页默认收起导航（body.bay-nav-collapsed）", () => {
  render(tree("/play"));
  expect(document.body).toHaveClass("bay-nav-collapsed");
});
